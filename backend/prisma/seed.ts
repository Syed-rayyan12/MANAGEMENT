import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed (org-level boards architecture)...');

  const password = await bcrypt.hash('password123', 10);

  // ─── 1. Create Organization ───────────────────────
  const org = await prisma.organization.upsert({
    where: { id: 'org-xpertwebstudio' },
    update: { name: 'XpertWebStudio' },
    create: { id: 'org-xpertwebstudio', name: 'XpertWebStudio' },
  });
  console.log(`✅ Organization: ${org.name}`);

  // ─── 2. Create Sales Teams ───────────────────────
  const teamDefs = [
    { id: 'team-1', name: 'Sales Team 1', slug: 'team-1' },
    { id: 'team-2', name: 'Sales Team 2', slug: 'team-2' },
  ];

  const teams: Record<string, any> = {};
  for (const t of teamDefs) {
    teams[t.slug] = await prisma.team.upsert({
      where: { slug: t.slug },
      update: { name: t.name },
      create: { id: t.id, name: t.name, slug: t.slug, organizationId: org.id },
    });
    console.log(`✅ Team: ${t.name}`);
  }

  // ─── 3. Create Org-Level Boards ──────────────────
  const boardDefs = [
    { id: 'board-logo', name: 'Logo Design', slug: 'logo-design' },
    { id: 'board-webdesign', name: 'Web Design', slug: 'web-design' },
    { id: 'board-webdev', name: 'Web Development', slug: 'web-development' },
    { id: 'board-content', name: 'Content Creation', slug: 'content' },
  ];

  const defaultColumns = [
    { name: 'To Do', key: 'todo', color: '#6B7280', position: 0 },
    { name: 'In Progress', key: 'in-progress', color: '#3B82F6', position: 1 },
    { name: 'Completed', key: 'completed', color: '#10B981', position: 2 },
    { name: 'Revisions', key: 'revisions', color: '#F59E0B', position: 3 },
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
    console.log(`✅ Board: ${b.name}`);
  }

  // ─── 3b. Add "Live" column to Web Development board ──
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
          color: '#8B5CF6',
          position: 4,
          boardId: webDevBoard.id,
        },
      });
      console.log('✅ Added "Live" column to Web Development board');
    } else {
      console.log('✅ "Live" column already exists on Web Development board');
    }
  }

  // ─── 4. Create Users ─────────────────────────────
  console.log('\nCreating users...');

  // Team 1: Ali (TL), Azhar (PM), Mujtaba (PM)
  // Team 2: Rashid (TL), Rehan (PM), Huzaifa (PM), Aqsa (PM)
  const teamUsers = [
    { username: 'tl.ali', email: 'tl.ali@company.com', password, role: 'TL' as const, name: 'Ali', teams: ['team-1'] },
    { username: 'pm.azharrajput', email: 'pm.azhar@company.com', password, role: 'PM' as const, name: 'Azhar Rajput', teams: ['team-1'] },
    { username: 'pm.mujtaba', email: 'pm.mujtaba@company.com', password, role: 'PM' as const, name: 'Mujtaba', teams: ['team-1'] },
    { username: 'tl.rashid', email: 'tl.rashid@company.com', password, role: 'TL' as const, name: 'Rashid', teams: ['team-2'] },
    { username: 'pm.rehan', email: 'pm.rehan@company.com', password, role: 'PM' as const, name: 'Rehan', teams: ['team-2'] },
    { username: 'pm.muhammadhuzafa', email: 'pm.huzaifa@company.com', password, role: 'PM' as const, name: 'Muhammad Huzaifa', teams: ['team-2'] },
    { username: 'pm.aqsarathore', email: 'pm.aqsa@company.com', password, role: 'PM' as const, name: 'Aqsa Rathore', teams: ['team-2'] },
  ];

  // Executives (no team — see everything)
  const executiveUsers = [
    { username: 'exec.muhammadmarij', email: 'exec1@company.com', password, role: 'EXECUTIVE' as const, name: 'Muhammad Marij' },
    { username: 'exec.tahaanwar', email: 'exec2@company.com', password, role: 'EXECUTIVE' as const, name: 'Taha Anwar' },
    { username: 'exec.khizerkhan', email: 'exec3@company.com', password, role: 'EXECUTIVE' as const, name: 'Khizer Khan' },
    { username: 'exec.babarkhan', email: 'exec4@company.com', password, role: 'EXECUTIVE' as const, name: 'Babar Khan' },
  ];

  // Production (no team — see all boards, only assigned tasks)
  const productionUsers = [
    { username: 'prod.abubakarsiddiqui', email: 'prod1@company.com', password, role: 'PRODUCTION' as const, name: 'Abubakar Siddiqui', specialization: 'DEVELOPER' as const },
    { username: 'prod.arshanhasan', email: 'prod2@company.com', password, role: 'PRODUCTION' as const, name: 'Arshan Hasan', specialization: 'FIGMA_DESIGNER' as const },
    { username: 'prod.syedtaha', email: 'prod3@company.com', password, role: 'PRODUCTION' as const, name: 'Syed Taha', specialization: 'DEVELOPER' as const },
    { username: 'prod.syedmuslim', email: 'prod4@company.com', password, role: 'PRODUCTION' as const, name: 'Syed Muslim', specialization: 'LOGO_DESIGNER' as const },
    { username: 'prod.syedrayyan', email: 'prod5@company.com', password, role: 'PRODUCTION' as const, name: 'Syed Rayyan', specialization: 'DEVELOPER' as const },
    { username: 'prod.tahiranwar', email: 'prod6@company.com', password, role: 'PRODUCTION' as const, name: 'Tahir Anwar', specialization: 'CONTENT_WRITER' as const },
    { username: 'prod.muhammadbinsaud', email: 'prod7@company.com', password, role: 'PRODUCTION' as const, name: 'Muhammad Bin Saud', specialization: 'FIGMA_DESIGNER' as const },
    { username: 'prod.qasimrizvi', email: 'prod8@company.com', password, role: 'PRODUCTION' as const, name: 'Qasim Rizvi', specialization: 'LOGO_DESIGNER' as const },
    { username: 'prod.syedakbar', email: 'prod9@company.com', password, role: 'PRODUCTION' as const, name: 'Syed Akbar', specialization: 'QA' as const },
    { username: 'prod.anaskhan', email: 'prod10@company.com', password, role: 'PRODUCTION' as const, name: 'Anas Khan', specialization: 'CONTENT_WRITER' as const },
    { username: 'prod.shakeebkhan', email: 'prod11@company.com', password, role: 'PRODUCTION' as const, name: 'Shakeeb Khan', specialization: 'QA' as const },
  ];

  // Create team users + membership
  for (const u of teamUsers) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { username: u.username, email: u.email, password: u.password, role: u.role, name: u.name },
    });
    for (const slug of u.teams) {
      await prisma.teamMember.upsert({
        where: { teamId_userId: { teamId: teams[slug].id, userId: user.id } },
        update: {},
        create: { teamId: teams[slug].id, userId: user.id },
      });
    }
    console.log(`✅ ${u.role}: ${user.name} → [${u.teams.join(', ')}]`);
  }

  // Create Executives
  for (const u of executiveUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { username: u.username, email: u.email, password: u.password, role: u.role, name: u.name },
    });
    console.log(`✅ EXEC: ${u.name}`);
  }

  // Create Production
  for (const u of productionUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { specialization: u.specialization },
      create: { username: u.username, email: u.email, password: u.password, role: u.role, name: u.name, specialization: u.specialization },
    });
    console.log(`✅ PROD: ${u.name} (${u.specialization})`);
  }

  console.log('\n✅ Database seeded successfully!');
  console.log('\n📋 Login Credentials (all passwords: password123):');
  console.log('\n🔹 Sales Team 1: Ali (TL), Azhar Rajput (PM), Mujtaba (PM)');
  console.log('🔹 Sales Team 2: Rashid (TL), Rehan (PM), Muhammad Huzaifa (PM), Aqsa Rathore (PM)');
  console.log('🔹 Executives: Muhammad Marij, Taha Anwar, Khizer Khan, Babar Khan');
  console.log('🔹 Production: 11 users (prod.abubakarsiddiqui, prod.arshanhasan, etc.)');
  console.log('\n📌 Boards: Logo Design, Web Design, Web Development, Content Creation');
  console.log('📌 All boards are org-level — visible to everyone. Team isolation is on projects.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
