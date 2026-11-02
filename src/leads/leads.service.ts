import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { User } from '../auth/user.entity';
import { frontendOrigin } from '../config';
import { renderEmail } from '../mail/mail-template';
import { MailService } from '../mail/mail.service';
import { Portal } from '../portal/portal.entity';
import { PortalService } from '../portal/portal.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { Lead } from './lead.entity';

/** Form text in a one-line header: no line breaks, no runs of spaces. */
const oneLine = (value: string) => value.replace(/\s+/g, ' ').trim();

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly portal: PortalService,
    private readonly mail: MailService,
  ) {}

  async create(dto: CreateLeadDto) {
    const portal = await this.portal.current();
    const lead = await this.leads.save(this.leads.create({ ...dto, portalId: portal.id }));
    // The visitor does not wait for the e-mail, and a mail failure does not lose the request.
    void this.notifyAdmins(lead, portal).catch((error: Error) =>
      this.logger.error('Falha ao avisar os administradores sobre um pedido comercial: ' + error.message),
    );
    return { message: 'Recebemos seu interesse. A equipe poderá entrar em contato.' };
  }

  /** E-mails each administrator who already uses the panel; "Responder" goes to whoever sent the request. */
  private async notifyAdmins(lead: Lead, portal: Portal) {
    const admins = await this.users.findBy({
      portalId: portal.id,
      role: 'admin',
      active: true,
      passwordSetAt: Not(IsNull()),
    });
    if (!admins.length) return;
    const email = renderEmail(portal.name, {
      preview: `${oneLine(lead.name)} quer anunciar: ${oneLine(lead.interest)}.`,
      heading: 'Novo pedido comercial',
      paragraphs: [
        `${lead.name} (${lead.email}) enviou um pedido pelo formulário “Anuncie” do ${portal.name}.`,
        `Espaço de interesse: ${lead.interest}`,
        `Mensagem: ${lead.message}`,
      ],
      action: { label: 'Abrir pedidos comerciais', url: `${frontendOrigin()}/admin?aba=leads` },
      note: `Para responder, use “Responder” neste e-mail: a resposta vai direto para ${lead.email}.`,
    });
    const subject = `Novo pedido comercial: ${oneLine(lead.interest)}`;
    for (const admin of admins) await this.mail.send({ to: admin.email, subject, replyTo: lead.email, ...email });
  }

  listAll(portalId: string) {
    return this.leads.find({ where: { portalId }, order: { createdAt: 'DESC' } });
  }

  async remove(id: string, portalId: string) {
    const { affected } = await this.leads.delete({ id, portalId });
    if (!affected) throw new NotFoundException();
    return { deleted: true };
  }
}
