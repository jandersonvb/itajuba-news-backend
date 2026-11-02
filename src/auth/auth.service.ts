import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Not, Repository } from 'typeorm';
import { frontendOrigin } from '../config';
import { renderEmail } from '../mail/mail-template';
import { MailService } from '../mail/mail.service';
import { PortalService } from '../portal/portal.service';
import {
  AdminTokenPayload,
  INVALID_INVITE,
  INVITE_TTL_DAYS,
  PASSWORD_RESET_TTL_MINUTES,
  StaffSession,
  TOKEN_TTL_SECONDS,
} from './auth.constants';
import { AcceptInviteDto } from './dto/invite.dto';
import { LoginDto } from './dto/login.dto';
import { ConfirmPasswordResetDto, RequestPasswordResetDto } from './dto/password-reset.dto';
import { hashPassword, verifyPassword } from './password';
import { User, UserRole } from './user.entity';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

const ROLE_NAMES: Record<UserRole, string> = { admin: 'administrador', editor: 'editor', reporter: 'repórter' };

/** `ja•••@gmail.com`: enough to recognize the address without publishing it. */
const maskEmail = (email: string) => {
  const [name, domain] = email.split('@');
  return `${name.slice(0, 2)}•••@${domain}`;
};

/** Hash of a random password nobody knows: the account cannot sign in until its invitation is used. */
export const unusablePassword = () => hashPassword(randomBytes(32).toString('base64url'));

/** Where the panel is in its first setup: no account, first admin invited, or ready to use. */
export type SetupStatus = { state: 'ready' } | { state: 'invited'; email: string } | { state: 'unconfigured' };

@Injectable()
export class AuthService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuthService.name);

  /** Checked when the e-mail does not exist, so both paths take the same time. */
  private readonly dummyHash = hashPassword('unused-random-password');

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    private readonly portal: PortalService,
    private readonly mail: MailService,
  ) {}

  async login({ email, password }: LoginDto) {
    const portal = await this.portal.current();
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.portalId = :portalId AND user.email = :email AND user.active = true', {
        portalId: portal.id,
        email: email.toLowerCase(),
      })
      .getOne();
    const valid = verifyPassword(password, user?.passwordHash || this.dummyHash);
    if (!user || !valid) throw new UnauthorizedException('E-mail ou senha inválidos');
    return this.issueToken(user, portal.id);
  }

  private async issueToken(user: User, portalId: string) {
    const payload: AdminTokenPayload = { sub: user.id, portalId, ver: user.sessionVersion };
    return { accessToken: await this.jwt.signAsync(payload), expiresIn: TOKEN_TTL_SECONDS };
  }

  /** Profile of the logged-in user, for the admin header and the tabs their role can see. */
  async me({ sub, portalId }: StaffSession) {
    const user = await this.users.findOneBy({ id: sub, portalId });
    if (!user) throw new NotFoundException();
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }

  // First administrator

  /**
   * First setup: while no account has a password, the administrator comes from ADMIN_EMAIL. The
   * account is created (or moved to a corrected ADMIN_EMAIL) and invited by e-mail. Nobody can
   * claim the panel from the browser: only whoever reads that inbox chooses the password.
   */
  async onApplicationBootstrap() {
    const portal = await this.portal.current().catch(() => null);
    if (!portal || (await this.setupStatus()).state === 'ready') return;
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (!email) {
      this.logger.warn('Nenhum administrador configurado. Defina ADMIN_EMAIL e reinicie a API para enviar o convite.');
      return;
    }
    const pending = await this.pendingFirstAdmin(portal.id);
    // Already invited: "Reenviar convite" on the login sends it again if needed.
    if (pending?.email === email) return;
    let id = pending?.id;
    if (id) await this.users.update(id, { email });
    else {
      const name = process.env.ADMIN_NAME?.trim() ?? '';
      const created = await this.users.save(
        this.users.create({ portalId: portal.id, email, name, role: 'admin', passwordHash: unusablePassword() }),
      );
      id = created.id;
    }
    const sent = await this.sendInvite(id).catch((error: Error) => {
      this.logger.error('Falha ao enviar o convite do administrador: ' + error.message);
      return false;
    });
    if (sent) this.logger.log(`Convite de administrador enviado para ${email}.`);
  }

  private pendingFirstAdmin(portalId: string) {
    return this.users.findOne({
      where: { portalId, role: 'admin', active: true, passwordSetAt: IsNull() },
      order: { createdAt: 'ASC' },
    });
  }

  /** What the login shows: the normal form, "convite enviado" or how to configure ADMIN_EMAIL. */
  async setupStatus(): Promise<SetupStatus> {
    const portal = await this.portal.current();
    if (await this.users.countBy({ portalId: portal.id, passwordSetAt: Not(IsNull()) })) return { state: 'ready' };
    const pending = await this.pendingFirstAdmin(portal.id);
    return pending ? { state: 'invited', email: maskEmail(pending.email) } : { state: 'unconfigured' };
  }

  /** "Reenviar convite" on the login during setup. Silent when there is no pending first admin. */
  async resendSetupInvite() {
    const portal = await this.portal.current();
    if ((await this.setupStatus()).state !== 'invited') return;
    const pending = await this.pendingFirstAdmin(portal.id);
    if (pending) await this.sendInvite(pending.id);
  }

  // Invitations

  /** Single-use link token for the user, replacing any previous one; only its hash is stored. */
  private async issueLinkToken(userId: string, ttlMs: number) {
    const token = randomBytes(32).toString('base64url');
    await this.users.update(userId, {
      passwordResetHash: sha256(token),
      passwordResetExpiresAt: new Date(Date.now() + ttlMs),
    });
    return token;
  }

  /**
   * E-mails the "criar minha senha" link, valid for INVITE_TTL_DAYS, replacing a previous one.
   * Returns false when the e-mail could not leave (production without a mail provider).
   */
  async sendInvite(userId: string, inviterId?: string) {
    const portal = await this.portal.current();
    const user = await this.users.findOneByOrFail({ id: userId, portalId: portal.id });
    const inviter = inviterId ? await this.users.findOneBy({ id: inviterId, portalId: portal.id }) : null;
    const token = await this.issueLinkToken(user.id, INVITE_TTL_DAYS * 24 * 60 * 60_000);
    const role = ROLE_NAMES[user.role];
    const email = renderEmail(portal.name, {
      preview: `Crie sua senha para acessar o painel da redação do ${portal.name}.`,
      heading: user.name
        ? `${user.name.split(' ')[0]}, seu convite para a redação chegou`
        : 'Seu convite para a redação chegou',
      paragraphs: [
        inviter?.name
          ? `${inviter.name} convidou você para o painel da redação do ${portal.name} como ${role}.`
          : `Você recebeu um convite para o painel da redação do ${portal.name} como ${role}.`,
        'Para entrar, crie a sua senha pelo botão abaixo. Depois, use este e-mail e a senha nova para acessar o painel.',
      ],
      action: { label: 'Criar minha senha', url: `${frontendOrigin()}/admin/convite?token=${token}` },
      note: `O link vale por ${INVITE_TTL_DAYS} dias e só pode ser usado uma vez. Se você não esperava este convite, ignore este e-mail.`,
    });
    return this.mail.send({ to: user.email, subject: `Convite para a redação do ${portal.name}`, ...email });
  }

  /** Who an invitation link is for, so the page can greet them before they choose a password. */
  async inviteInfo(token: string) {
    const user = await this.userByLink(token);
    if (!user) throw new BadRequestException(INVALID_INVITE);
    return { name: user.name, email: user.email, role: user.role };
  }

  /** Uses the invitation link once: sets the password (and the name, if given) and signs the user in. */
  async acceptInvite({ token, password, name }: AcceptInviteDto) {
    const portal = await this.portal.current();
    const user = await this.userByLink(token);
    if (!user) throw new BadRequestException(INVALID_INVITE);
    const { affected } = await this.users.update(
      { id: user.id, passwordResetHash: sha256(token) },
      {
        ...(name ? { name } : {}),
        passwordHash: hashPassword(password),
        passwordSetAt: new Date(),
        sessionVersion: () => '"sessionVersion" + 1',
        passwordResetHash: null,
        passwordResetExpiresAt: null,
      },
    );
    // Used by a parallel request in the meantime.
    if (!affected) throw new BadRequestException(INVALID_INVITE);
    return this.issueToken(await this.users.findOneByOrFail({ id: user.id }), portal.id);
  }

  private async userByLink(token: string) {
    const portal = await this.portal.current();
    return this.users.findOneBy({
      portalId: portal.id,
      passwordResetHash: sha256(token),
      passwordResetExpiresAt: MoreThan(new Date()),
      active: true,
    });
  }

  // Password reset

  /**
   * E-mails an active user a single-use link to choose a new password; a new request replaces the
   * previous link. The same query runs whether or not the e-mail has an account and the e-mail is
   * sent in the background, so the response does not reveal who has one.
   */
  async requestPasswordReset({ email }: RequestPasswordResetDto) {
    const portal = await this.portal.current();
    const to = email.toLowerCase();
    const token = randomBytes(32).toString('base64url');
    const { affected } = await this.users.update(
      { portalId: portal.id, email: to, active: true },
      {
        passwordResetHash: sha256(token),
        passwordResetExpiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60_000),
      },
    );
    if (!affected) return;
    const message = renderEmail(portal.name, {
      preview: 'Use o link para escolher uma nova senha.',
      heading: 'Redefinição de senha',
      paragraphs: [
        `Recebemos um pedido para redefinir a senha da sua conta no painel da redação do ${portal.name}.`,
        'Para escolher uma nova senha, use o botão abaixo.',
      ],
      action: { label: 'Escolher nova senha', url: `${frontendOrigin()}/admin/redefinir-senha?token=${token}` },
      note: `O link vale por ${PASSWORD_RESET_TTL_MINUTES} minutos e só pode ser usado uma vez. Se você não fez esse pedido, ignore este e-mail: sua senha continua a mesma.`,
    });
    this.mail
      .send({ to, subject: `Redefinição de senha · ${portal.name}`, ...message })
      .catch((error: Error) => this.logger.error('Falha ao enviar o e-mail de redefinição de senha: ' + error.message));
  }

  /** Uses the link from the e-mail once: sets the new password and ends the user's open sessions. */
  async resetPassword({ token, password }: ConfirmPasswordResetDto) {
    const portal = await this.portal.current();
    const { affected } = await this.users.update(
      {
        portalId: portal.id,
        passwordResetHash: sha256(token),
        passwordResetExpiresAt: MoreThan(new Date()),
        active: true,
      },
      {
        passwordHash: hashPassword(password),
        passwordSetAt: new Date(),
        sessionVersion: () => '"sessionVersion" + 1',
        passwordResetHash: null,
        passwordResetExpiresAt: null,
      },
    );
    if (!affected) throw new BadRequestException('Link inválido ou expirado. Peça um novo.');
    return { updated: true };
  }
}
