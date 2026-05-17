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
    { name: 'To Do', key: 'todo', color: '#6B7280', position: 0, phase: 'NOT_STARTED' as const },
    { name: 'In Progress', key: 'in-progress', color: '#3B82F6', position: 1, phase: 'IN_PROGRESS' as const },
    { name: 'Completed', key: 'completed', color: '#10B981', position: 2, phase: 'DONE' as const },
    { name: 'Revisions', key: 'revisions', color: '#F59E0B', position: 3, phase: 'IN_PROGRESS' as const },
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
          color: '#10B981',
          position: 4,
          boardId: webDevBoard.id,
          phase: 'DONE',
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

  // ─── 5. Create Sample Projects with Assignments ─────
  console.log('\nCreating sample projects with assignments...');

  // Fetch created users for reference
  const azhar = await prisma.user.findUnique({ where: { email: 'pm.azhar@company.com' } });
  const mujtaba = await prisma.user.findUnique({ where: { email: 'pm.mujtaba@company.com' } });
  const rehan = await prisma.user.findUnique({ where: { email: 'pm.rehan@company.com' } });
  const huzaifa = await prisma.user.findUnique({ where: { email: 'pm.huzaifa@company.com' } });
  const aqsa = await prisma.user.findUnique({ where: { email: 'pm.aqsa@company.com' } });
  const abubakar = await prisma.user.findUnique({ where: { email: 'prod1@company.com' } });
  const arshan = await prisma.user.findUnique({ where: { email: 'prod2@company.com' } });
  const syedTaha = await prisma.user.findUnique({ where: { email: 'prod3@company.com' } });
  const syedMuslim = await prisma.user.findUnique({ where: { email: 'prod4@company.com' } });
  const syedRayyan = await prisma.user.findUnique({ where: { email: 'prod5@company.com' } });
  const tahir = await prisma.user.findUnique({ where: { email: 'prod6@company.com' } });
  const binSaud = await prisma.user.findUnique({ where: { email: 'prod7@company.com' } });
  const qasim = await prisma.user.findUnique({ where: { email: 'prod8@company.com' } });
  const syedAkbar = await prisma.user.findUnique({ where: { email: 'prod9@company.com' } });
  const anas = await prisma.user.findUnique({ where: { email: 'prod10@company.com' } });
  const shakeeb = await prisma.user.findUnique({ where: { email: 'prod11@company.com' } });

  if (azhar && mujtaba && rehan && huzaifa && aqsa && abubakar && arshan && syedTaha && syedMuslim && syedRayyan && tahir && binSaud && qasim && syedAkbar && anas && shakeeb) {
    const boards = {
      logo: await prisma.board.findUnique({ where: { slug: 'logo-design' } }),
      webDesign: await prisma.board.findUnique({ where: { slug: 'web-design' } }),
      webDev: await prisma.board.findUnique({ where: { slug: 'web-development' } }),
      content: await prisma.board.findUnique({ where: { slug: 'content' } }),
    };

    const sampleProjects = [
      // Team 1, Web Dev board — multiple assignments
      { name: 'ABC Corp Website', boardSlug: 'web-development', teamSlug: 'team-1', status: 'completed', priority: 'HIGH' as const, assignments: [
        { userId: azhar!.id, role: 'PRIMARY' as const, status: 'DONE' as const },
        { userId: abubakar!.id, role: 'PRIMARY' as const, status: 'DONE' as const },
        { userId: arshan!.id, role: 'PRIMARY' as const, status: 'DONE' as const },
        { userId: syedAkbar!.id, role: 'COLLABORATOR' as const, status: 'DONE' as const },
      ]},
      { name: 'XYZ Landing Page', boardSlug: 'web-development', teamSlug: 'team-1', status: 'in-progress', priority: 'MEDIUM' as const, assignments: [
        { userId: azhar!.id, role: 'PRIMARY' as const, status: 'ACTIVE' as const },
        { userId: syedTaha!.id, role: 'PRIMARY' as const, status: 'ACTIVE' as const },
        { userId: binSaud!.id, role: 'COLLABORATOR' as const, status: 'DONE' as const },
      ]},
      { name: 'StartupHub Platform', boardSlug: 'web-development', teamSlug: 'team-1', status: 'live', priority: 'CRITICAL' as const, assignments: [
        { userId: mujtaba!.id, role: 'PRIMARY' as const, status: 'DONE' as const },
        { userId: syedRayyan!.id, role: 'PRIMARY' as const, status: 'DONE' as const },
        { userId: arshan!.id, role: 'COLLABORATOR' as const, status: 'DONE' as const },
        { userId: shakeeb!.id, role: 'PRIMARY' as const, status: 'DONE' as const },
        { userId: tahir!.id, role: 'COLLABORATOR' as const, status: 'DONE' as const },
      ]},
      // Team 2, Logo board
      { name: 'TechVenture Logo', boardSlug: 'logo-design', teamSlug: 'team-2', status: 'completed', priority: 'MEDIUM' as const, assignments: [
        { userId: rehan!.id, role: 'PRIMARY' as const, status: 'DONE' as const },
        { userId: syedMuslim!.id, role: 'PRIMARY' as const, status: 'DONE' as const },
        { userId: qasim!.id, role: 'COLLABORATOR' as const, status: 'DONE' as const },
      ]},
      { name: 'GreenLeaf Branding', boardSlug: 'logo-design', teamSlug: 'team-2', status: 'in-progress', priority: 'LOW' as const, assignments: [
        { userId: rehan!.id, role: 'PRIMARY' as const, status: 'ACTIVE' as const },
        { userId: qasim!.id, role: 'PRIMARY' as const, status: 'ACTIVE' as const },
      ]},
      // Team 1, Web Design board
      { name: 'FoodDelivery App UI', boardSlug: 'web-design', teamSlug: 'team-1', status: 'revisions', priority: 'HIGH' as const, assignments: [
        { userId: mujtaba!.id, role: 'PRIMARY' as const, status: 'ACTIVE' as const },
        { userId: arshan!.id, role: 'PRIMARY' as const, status: 'ACTIVE' as const },
        { userId: binSaud!.id, role: 'PRIMARY' as const, status: 'ACTIVE' as const },
      ]},
      // Team 2, Content board
      { name: 'TechBlog Launch Content', boardSlug: 'content', teamSlug: 'team-2', status: 'completed', priority: 'MEDIUM' as const, assignments: [
        { userId: rehan!.id, role: 'PRIMARY' as const, status: 'DONE' as const },
        { userId: tahir!.id, role: 'PRIMARY' as const, status: 'DONE' as const },
        { userId: anas!.id, role: 'COLLABORATOR' as const, status: 'DONE' as const },
      ]},
      { name: 'SaaS Product Copy', boardSlug: 'content', teamSlug: 'team-2', status: 'in-progress', priority: 'HIGH' as const, assignments: [
        { userId: aqsa!.id, role: 'PRIMARY' as const, status: 'ACTIVE' as const },
        { userId: anas!.id, role: 'PRIMARY' as const, status: 'ACTIVE' as const },
      ]},
      // More web dev for richer KPI data
      { name: 'E-Commerce Platform', boardSlug: 'web-development', teamSlug: 'team-2', status: 'in-progress', priority: 'CRITICAL' as const, assignments: [
        { userId: rehan!.id, role: 'PRIMARY' as const, status: 'ACTIVE' as const },
        { userId: abubakar!.id, role: 'PRIMARY' as const, status: 'ACTIVE' as const },
        { userId: syedRayyan!.id, role: 'COLLABORATOR' as const, status: 'ACTIVE' as const },
        { userId: arshan!.id, role: 'COLLABORATOR' as const, status: 'DONE' as const },
        { userId: syedAkbar!.id, role: 'PRIMARY' as const, status: 'ACTIVE' as const },
      ]},
      { name: 'Portfolio Revamp', boardSlug: 'web-development', teamSlug: 'team-1', status: 'live', priority: 'MEDIUM' as const, assignments: [
        { userId: azhar!.id, role: 'PRIMARY' as const, status: 'DONE' as const },
        { userId: syedTaha!.id, role: 'PRIMARY' as const, status: 'DONE' as const },
        { userId: shakeeb!.id, role: 'COLLABORATOR' as const, status: 'DONE' as const },
      ]},
    ];

    for (const proj of sampleProjects) {
      const board = boards[proj.boardSlug === 'web-development' ? 'webDev' : proj.boardSlug === 'web-design' ? 'webDesign' : proj.boardSlug === 'logo-design' ? 'logo' : 'content'];
      if (!board) continue;

      // Set a due date a few days in the future for active projects, or a few days ago for completed ones
      const isCompleted = proj.status === 'completed' || proj.status === 'live';
      const dueDaysOffset = isCompleted
        ? Math.floor(Math.random() * 5) - 2  // -2 to +2 days from now (some late, some on time)
        : Math.floor(Math.random() * 14) + 3; // 3-16 days in the future
      const dueDate = new Date(Date.now() + dueDaysOffset * 24 * 60 * 60 * 1000);

      const project = await prisma.project.create({
        data: {
          name: proj.name,
          boardId: board.id,
          teamId: teams[proj.teamSlug].id,
          status: proj.status,
          priority: proj.priority,
          dueDate,
        },
      });

      for (const a of proj.assignments) {
        // Simulate realistic turnaround: assigned 3-21 days ago, completed 1-3 days ago
        const daysAgo = Math.floor(Math.random() * 19) + 3; // 3-21 days ago
        const completedDaysAgo = Math.floor(Math.random() * 3) + 1; // 1-3 days ago
        const assignedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
        const completedAt = a.status === 'DONE'
          ? new Date(Date.now() - completedDaysAgo * 24 * 60 * 60 * 1000)
          : null;

        await prisma.projectAssignment.create({
          data: {
            projectId: project.id,
            userId: a.userId,
            role: a.role,
            status: a.status,
            assignedAt,
            completedAt,
          },
        });
      }

      console.log(`✅ Project: ${proj.name} (${proj.assignments.length} members)`);
    }
  }

  // Backfill phase for existing columns that still have the default NOT_STARTED
  const phaseMap: Record<string, string> = {
    'todo': 'NOT_STARTED',
    'to-do': 'NOT_STARTED',
    'backlog': 'NOT_STARTED',
    'in-progress': 'IN_PROGRESS',
    'revisions': 'IN_PROGRESS',
    'review': 'IN_PROGRESS',
    'completed': 'DONE',
    'done': 'DONE',
    'live': 'DONE',
    'on-hold': 'ON_HOLD',
  };

  for (const [key, phase] of Object.entries(phaseMap)) {
    await prisma.boardColumn.updateMany({
      where: { key },
      data: { phase: phase as any },
    });
  }
  console.log('✅ Backfilled column phases');

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
