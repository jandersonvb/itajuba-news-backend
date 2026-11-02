import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { AuthService, unusablePassword } from '../auth/auth.service';
import { hashPassword } from '../auth/password';
import { User } from '../auth/user.entity';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

const UNIQUE_VIOLATION = '23505';

/** Fields the admin sees; never the password hash. `pending`: invited, password not chosen yet. */
const view = ({ id, name, email, role, active, createdAt, passwordSetAt, passwordResetExpiresAt }: User) => ({
  id,
  name,
  email,
  role,
  active,
  createdAt,
  pending: !passwordSetAt,
  inviteExpiresAt: passwordSetAt ? null : (passwordResetExpiresAt ?? null),
});

/**
 * Staff accounts of a portal. Users are deactivated instead of deleted, so the articles keep
 * pointing to who created them.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly auth: AuthService,
  ) {}

  async listAll(portalId: string) {
    const rows = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordResetExpiresAt')
      .where('user.portalId = :portalId', { portalId })
      .orderBy('user.active', 'DESC')
      .addOrderBy('user.name', 'ASC')
      .addOrderBy('user.email', 'ASC')
      .getMany();
    return rows.map(view);
  }

  /**
   * Without a password the account is invited: the person gets an e-mail to choose their own. With
   * one (API clients, scripts), it can sign in right away. `inviteSent` is false when the e-mail
   * could not leave; the admin can resend it later.
   */
  async create({ password, ...dto }: CreateUserDto, portalId: string, inviterId: string) {
    if (password)
      return this.persist({ ...dto, portalId, passwordHash: hashPassword(password), passwordSetAt: new Date() });
    const user = await this.persist({ ...dto, portalId, passwordHash: unusablePassword() });
    return { ...user, inviteSent: await this.invite(user.id, inviterId) };
  }

  /**
   * An admin cannot demote or deactivate themselves, so the portal always keeps an active admin.
   * A new e-mail cancels the links sent to the old one; an invited person gets a new invitation.
   */
  async update(id: string, dto: UpdateUserDto, portalId: string, actorId: string) {
    const existing = await this.users.findOneBy({ id, portalId });
    if (!existing) throw new NotFoundException();
    if (id === actorId && ((dto.role && dto.role !== 'admin') || dto.active === false))
      throw new BadRequestException('Você não pode remover o seu próprio acesso de administrador');
    const emailChanged = !!dto.email && dto.email !== existing.email;
    const user = await this.persist({
      ...existing,
      ...dto,
      portalId,
      ...(emailChanged ? { passwordResetHash: null, passwordResetExpiresAt: null } : {}),
    });
    if (emailChanged && user.pending && user.active) return { ...user, inviteSent: await this.invite(id, actorId) };
    return user;
  }

  /** "Reenviar convite": a new link replaces the previous one. */
  async resendInvite(id: string, portalId: string, inviterId: string) {
    const user = await this.users.findOneBy({ id, portalId });
    if (!user) throw new NotFoundException();
    if (user.passwordSetAt) throw new ConflictException('Esta pessoa já criou a senha.');
    if (!user.active) throw new BadRequestException('Reative o usuário antes de reenviar o convite.');
    if (!(await this.invite(id, inviterId)))
      throw new ServiceUnavailableException(
        'O e-mail não foi enviado. Confira a configuração de e-mail do servidor (RESEND_API_KEY ou SMTP).',
      );
    return { sent: true };
  }

  /** Sets a new password and ends the user's open sessions. Also completes a pending invitation. */
  async resetPassword(id: string, password: string, portalId: string) {
    const { affected } = await this.users.update(
      { id, portalId },
      {
        passwordHash: hashPassword(password),
        passwordSetAt: new Date(),
        sessionVersion: () => '"sessionVersion" + 1',
        passwordResetHash: null,
        passwordResetExpiresAt: null,
      },
    );
    if (!affected) throw new NotFoundException();
    return { updated: true };
  }

  private invite(id: string, inviterId: string) {
    return this.auth.sendInvite(id, inviterId).catch((error: Error) => {
      this.logger.error('Falha ao enviar o convite: ' + error.message);
      return false;
    });
  }

  private async persist(data: DeepPartial<User>) {
    try {
      return view(await this.users.save(this.users.create(data)));
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) throw new ConflictException('E-mail já cadastrado');
      throw error;
    }
  }
}
