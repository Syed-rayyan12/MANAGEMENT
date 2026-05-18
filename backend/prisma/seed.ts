import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed (XRM clean slate)...');

  const password = await bcrypt.hash('password123', 10);

  // ─── 1. Wipe everything ─────────────────────────────────
  console.log('Clearing existing data...');
  await prisma.invoice.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.projectLabel.deleteMany();
  await prisma.label.deleteMany();
  await prisma.checklistItem.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.regression.deleteMany();
  await prisma.projectAssignment.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.project.deleteMany();
  await prisma.client.deleteMany();
  await prisma.boardColumn.deleteMany();
  await prisma.board.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.team.deleteMany();
  await prisma.organization.deleteMany();
  console.log('All data cleared.');

  // ─── 2. Organization ────────────────────────────────────
  const org = await prisma.organization.create({
    data: { id: 'org-xpertwebstudio', name: 'XpertWebStudio' },
  });
  console.log(`Organization: ${org.name}`);

  // ─── 3. Single Team ─────────────────────────────────────
  const team = await prisma.team.create({
    data: {
      id: 'team-xws',
      name: 'Xpert Web Studio',
      slug: 'xpert-web-studio',
      organizationId: org.id,
    },
  });
  console.log(`Team: ${team.name}`);

  // ─── 4. Users ───────────────────────────────────────────
  console.log('\nCreating users...');

  type UserRole = 'TL' | 'PM' | 'PRODUCTION' | 'EXECUTIVE';

  interface UserDef {
    username: string;
    name: string;
    role: UserRole;
  }

  const userDefs: UserDef[] = [
    { username: 'prod.tahiranwar',  name: 'Tahir Anwar',  role: 'PRODUCTION' },
    { username: 'exec.maarijsaud',  name: 'Maarij Saud',  role: 'EXECUTIVE'  },
    { username: 'exec.khizarfaiz',  name: 'Khizar Faiz',  role: 'EXECUTIVE'  },
    { username: 'exec.babarkhan',   name: 'Babar Khan',   role: 'EXECUTIVE'  },
  ];

  for (const u of userDefs) {
    const email = `${u.username}@company.com`;

    const user = await prisma.user.create({
      data: {
        username: u.username,
        email,
        password,
        role: u.role,
        name: u.name,
      },
    });

    await prisma.teamMember.create({
      data: { teamId: team.id, userId: user.id },
    });

    console.log(`  ${u.role}: ${u.name} (${u.username})`);
  }

  // ─── Summary ────────────────────────────────────────────
  console.log('\n========================================');
  console.log('Database seeded successfully!');
  console.log('========================================');
  console.log(`\nOrganization : ${org.name}`);
  console.log(`Team         : ${team.name} (${team.slug})`);
  console.log(`Users        : ${userDefs.length} total — password: password123`);
  console.log('');
  for (const u of userDefs) {
    console.log(`  ${u.role}: ${u.username}`);
  }
  console.log('');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
