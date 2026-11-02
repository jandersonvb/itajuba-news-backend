import { Initial1781000000000 } from './1781000000000-Initial';
import { CategoryPosition1791660214019 } from './1791660214019-CategoryPosition';
import { Media1791660214020 } from './1791660214020-Media';
import { UserRoles1791700000000 } from './1791700000000-UserRoles';
import { PasswordReset1791800000000 } from './1791800000000-PasswordReset';
import { Invitations1791900000000 } from './1791900000000-Invitations';
import { ArticleUpdatedAt1792000000000 } from './1792000000000-ArticleUpdatedAt';

/** Applied in this order by `npm run db:migrate` and by the tests. Add new migrations at the end. */
export const migrations = [
  Initial1781000000000,
  CategoryPosition1791660214019,
  Media1791660214020,
  UserRoles1791700000000,
  PasswordReset1791800000000,
  Invitations1791900000000,
  ArticleUpdatedAt1792000000000,
];
