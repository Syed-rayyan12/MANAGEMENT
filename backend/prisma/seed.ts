import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed (XRM team roster)...');

  const password = await bcrypt.hash('password123', 10);

  // ─── 1. Organization ───────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { id: 'org-xpertwebstudio' },
    update: { name: 'XpertWebStudio' },
    create: { id: 'org-xpertwebstudio', name: 'XpertWebStudio' },
  });
  console.log(`Organization: ${org.name}`);

  // ─── 2. Single Team ────────────────────────────────────
  const team = await prisma.team.upsert({
    where: { slug: 'xpert-web-studio' },
    update: { name: 'Xpert Web Studio' },
    create: {
      id: 'team-xws',
      name: 'Xpert Web Studio',
      slug: 'xpert-web-studio',
      organizationId: org.id,
    },
  });
  console.log(`Team: ${team.name}`);

  // ─── 3. Org-Level Boards ───────────────────────────────
  const boardDefs = [
    { id: 'board-logo',     name: 'Logo Design',      slug: 'logo-design'      },
    { id: 'board-webdesign',name: 'Web Design',        slug: 'web-design'       },
    { id: 'board-webdev',   name: 'Web Development',   slug: 'web-development'  },
    { id: 'board-content',  name: 'Content Creation',  slug: 'content'          },
  ];

  const defaultColumns = [
    { name: 'To Do',       key: 'todo',        color: '#6B7280', position: 0, phase: 'NOT_STARTED' as const },
    { name: 'In Progress', key: 'in-progress', color: '#3B82F6', position: 1, phase: 'IN_PROGRESS' as const },
    { name: 'Completed',   key: 'completed',   color: '#10B981', position: 2, phase: 'DONE'        as const },
    { name: 'Revisions',   key: 'revisions',   color: '#F59E0B', position: 3, phase: 'IN_PROGRESS' as const },
  ];

  for (const b of boardDefs) {
    const existing = await prisma.board.findUnique({ where: { slug: b.slug } });
    if (!existing) {
      await prisma.board.create({
        data: {
          id: b.id,
          name: b.name,
          slug: b.slug,
          organizationId: org.id,
          columns: { create: defaultColumns },
        },
      });
    }
    console.log(`Board: ${b.name}`);
  }

  // ─── 3b. "Live" column on Web Development ──────────────
  const webDevBoard = await prisma.board.findUnique({ where: { slug: 'web-development' } });
  if (webDevBoard) {
    const existingLiveCol = await prisma.boardColumn.findUnique({
      where: { boardId_key: { boardId: webDevBoard.id, key: 'live' } },
    });
    if (!existingLiveCol) {
      await prisma.boardColumn.create({
        data: {
          name: 'Live',
          key: 'live',
          color: '#10B981',
          position: 4,
          boardId: webDevBoard.id,
          phase: 'DONE',
        },
      });
      console.log('Added "Live" column to Web Development board');
    } else {
      console.log('"Live" column already exists on Web Development board');
    }
  }

  // ─── 4. Users ──────────────────────────────────────────
  console.log('\nCreating users...');

  type UserRole = 'TL' | 'PM' | 'PRODUCTION' | 'EXECUTIVE';
  type Specialization = 'LOGO_DESIGNER' | 'FIGMA_DESIGNER' | 'DEVELOPER' | 'CONTENT_WRITER' | 'QA';

  interface UserDef {
    username: string;
    name: string;
    role: UserRole;
    specialization?: Specialization;
    inTeam: boolean;
  }

  const userDefs: UserDef[] = [
    // TL
    { username: 'tl.ali',              name: 'Ali',               role: 'TL',         inTeam: true  },
    // PMs
    { username: 'pm.rehan',            name: 'Rehan',             role: 'PM',         inTeam: true  },
    { username: 'pm.mujtaba',          name: 'Mujtaba',           role: 'PM',         inTeam: true  },
    { username: 'pm.anas',             name: 'Anas',              role: 'PM',         inTeam: true  },
    { username: 'pm.aqsa',             name: 'Aqsa',              role: 'PM',         inTeam: true  },
    // Production
    { username: 'prod.aqsa',           name: 'Aqsa',              role: 'PRODUCTION', specialization: 'LOGO_DESIGNER',   inTeam: true },
    { username: 'prod.abubakr',        name: 'Abu Bakr',          role: 'PRODUCTION', specialization: 'LOGO_DESIGNER',   inTeam: true },
    { username: 'prod.arshanhasan',    name: 'Arshan Hasan',      role: 'PRODUCTION', specialization: 'FIGMA_DESIGNER',  inTeam: true },
    { username: 'prod.syedtaha',       name: 'Syed Taha',         role: 'PRODUCTION', specialization: 'FIGMA_DESIGNER',  inTeam: true },
    { username: 'prod.syedrayyan',     name: 'Syed Rayyan',       role: 'PRODUCTION', specialization: 'DEVELOPER',       inTeam: true },
    { username: 'prod.muslimraza',     name: 'Muslim Raza',       role: 'PRODUCTION', specialization: 'DEVELOPER',       inTeam: true },
    { username: 'prod.qasimrizvi',     name: 'Qasim Rizvi',       role: 'PRODUCTION', specialization: 'DEVELOPER',       inTeam: true },
    { username: 'prod.akbar',          name: 'Akbar',             role: 'PRODUCTION', specialization: 'DEVELOPER',       inTeam: true },
    { username: 'prod.muhammadbinsaud',name: 'Muhammad Bin Saud', role: 'PRODUCTION', specialization: 'DEVELOPER',       inTeam: true },
    { username: 'prod.tahiranwar',     name: 'Tahir Anwar',       role: 'PRODUCTION', inTeam: true },
    // Executives
    { username: 'exec.maarijsaud',     name: 'Maarij Saud',       role: 'EXECUTIVE',  inTeam: true },
    { username: 'exec.khizarfaiz',     name: 'Khizar Faiz',       role: 'EXECUTIVE',  inTeam: true },
    { username: 'exec.babarkhan',      name: 'Babar Khan',        role: 'EXECUTIVE',  inTeam: true },
  ];

  const createdUsers: { username: string; name: string; role: UserRole }[] = [];

  for (const u of userDefs) {
    const email = `${u.username}@company.com`;

    // Delete any old user that holds this email under a different username
    const emailConflict = await prisma.user.findUnique({ where: { email } });
    if (emailConflict && emailConflict.username !== u.username) {
      await prisma.teamMember.deleteMany({ where: { userId: emailConflict.id } });
      await prisma.projectAssignment.deleteMany({ where: { userId: emailConflict.id } });
      await prisma.user.delete({ where: { id: emailConflict.id } });
    }

    const user = await prisma.user.upsert({
      where: { username: u.username },
      update: {
        name: u.name,
        email,
        role: u.role,
        ...(u.specialization !== undefined ? { specialization: u.specialization } : {}),
      },
      create: {
        username: u.username,
        email,
        password,
        role: u.role,
        name: u.name,
        ...(u.specialization !== undefined ? { specialization: u.specialization } : {}),
      },
    });

    if (u.inTeam) {
      await prisma.teamMember.upsert({
        where: { teamId_userId: { teamId: team.id, userId: user.id } },
        update: {},
        create: { teamId: team.id, userId: user.id },
      });
    }

    const spec = u.specialization ? ` (${u.specialization})` : '';
    console.log(`  ${u.role}: ${u.name}${spec}`);
    createdUsers.push({ username: u.username, name: u.name, role: u.role });
  }

  // ─── 5. Column phase backfill ──────────────────────────
  const phaseMap: Record<string, string> = {
    'todo':        'NOT_STARTED',
    'to-do':       'NOT_STARTED',
    'backlog':     'NOT_STARTED',
    'in-progress': 'IN_PROGRESS',
    'revisions':   'IN_PROGRESS',
    'review':      'IN_PROGRESS',
    'completed':   'DONE',
    'done':        'DONE',
    'live':        'DONE',
    'on-hold':     'ON_HOLD',
  };

  for (const [key, phase] of Object.entries(phaseMap)) {
    await prisma.boardColumn.updateMany({
      where: { key },
      data: { phase: phase as any },
    });
  }
  console.log('\nBackfilled column phases');

  // ─── Summary ───────────────────────────────────────────
  console.log('\n========================================');
  console.log('Database seeded successfully!');
  console.log('========================================');
  console.log(`\nOrganization : ${org.name}`);
  console.log(`Team         : ${team.name} (${team.slug})`);
  console.log(`Boards       : Logo Design, Web Design, Web Development, Content Creation`);
  console.log(`\nUsers created / updated (${createdUsers.length} total) — password: password123`);
  console.log('');

  const byRole: Record<string, typeof createdUsers> = {};
  for (const u of createdUsers) {
    (byRole[u.role] ??= []).push(u);
  }
  for (const [role, users] of Object.entries(byRole)) {
    console.log(`  ${role}:`);
    for (const u of users) {
      console.log(`    ${u.username}`);
    }
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
