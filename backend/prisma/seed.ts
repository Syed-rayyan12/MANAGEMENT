import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed (multi-team architecture)...');

  const password = await bcrypt.hash('password123', 10);

  // ─── 1. Create Organization ───────────────────────
  const org = await prisma.organization.upsert({
    where: { id: 'org-xpertwebstudio' },
    update: { name: 'XpertWebStudio' },
    create: { id: 'org-xpertwebstudio', name: 'XpertWebStudio' },
  });
  console.log(`✅ Organization: ${org.name}`);

  // ─── 2. Create Teams ─────────────────────────────
  const teamDefs = [
    { id: 'team-logo', name: 'Logo Design', slug: 'logo-design' },
    { id: 'team-webdesign', name: 'Web Design', slug: 'web-design' },
    { id: 'team-webdev', name: 'Web Development', slug: 'web-development' },
    { id: 'team-content', name: 'Content Creation', slug: 'content' },
  ];

  const teams: Record<string, any> = {};
  for (const t of teamDefs) {
    teams[t.slug] = await prisma.team.upsert({
      where: { slug: t.slug },
      update: { name: t.name },
      create: { id: t.id, name: t.name, slug: t.slug, organizationId: org.id },
    });
    console.log(`✅ Team: ${t.name} (${t.slug})`);
  }

  // ─── 3. Create Workspaces (1:1 with each Team) ───
  const defaultColumns = [
    { name: 'To Do', key: 'todo', color: '#6B7280', position: 0 },
    { name: 'In Progress', key: 'in-progress', color: '#3B82F6', position: 1 },
    { name: 'Completed', key: 'completed', color: '#10B981', position: 2 },
    { name: 'Revisions', key: 'revisions', color: '#F59E0B', position: 3 },
  ];

  for (const t of teamDefs) {
    const team = teams[t.slug];
    const existing = await prisma.workspace.findUnique({ where: { teamId: team.id } });
    if (!existing) {
      await prisma.workspace.create({
        data: {
          name: t.name,
          teamId: team.id,
          columns: { create: defaultColumns },
        },
      });
    }
    console.log(`✅ Workspace: ${t.name}`);
  }

  // ─── 4. Create Users ─────────────────────────────
  console.log('\nCreating users...');

  // Team Leads (TL1 → logo-design + web-design, TL2 → web-development + content)
  const tlUsers = [
    { username: 'tl.mustufa', email: 'tl1@company.com', password, role: 'TL' as const, name: 'Mustufa', teams: ['logo-design', 'web-design'] },
    { username: 'tl.ali', email: 'tl2@company.com', password, role: 'TL' as const, name: 'Ali', teams: ['web-development', 'content'] },
  ];

  // PMs (each assigned to a specific team)
  const pmUsers = [
    { username: 'pm.azharrajput', email: 'pm1@company.com', password, role: 'PM' as const, name: 'Azhar Rajput', teams: ['logo-design'] },
    { username: 'pm.aqsarathore', email: 'pm2@company.com', password, role: 'PM' as const, name: 'Aqsa Rathore', teams: ['web-design'] },
    { username: 'pm.muhammadhuzafa', email: 'pm3@company.com', password, role: 'PM' as const, name: 'Muhammad Huzafa', teams: ['web-development'] },
  ];

  // Executives (not team members — they see all via role)
  const executiveUsers = [
    { username: 'exec.muhammadmarij', email: 'exec1@company.com', password, role: 'EXECUTIVE' as const, name: 'Muhammad Marij' },
    { username: 'exec.tahaanwar', email: 'exec2@company.com', password, role: 'EXECUTIVE' as const, name: 'Taha Anwar' },
    { username: 'exec.khizerkhan', email: 'exec3@company.com', password, role: 'EXECUTIVE' as const, name: 'Khizer Khan' },
    { username: 'exec.babarkhan', email: 'exec4@company.com', password, role: 'EXECUTIVE' as const, name: 'Babar Khan' },
  ];

  // Production (cross-team, not team members — they see tasks assigned to them)
  const productionUsers = [
    { username: 'prod.abubakarsiddiqui', email: 'prod1@company.com', password, role: 'PRODUCTION' as const, name: 'Abubakar Siddiqui' },
    { username: 'prod.arshanhasan', email: 'prod2@company.com', password, role: 'PRODUCTION' as const, name: 'Arshan Hasan' },
    { username: 'prod.syedtaha', email: 'prod3@company.com', password, role: 'PRODUCTION' as const, name: 'Syed Taha' },
    { username: 'prod.syedmuslim', email: 'prod4@company.com', password, role: 'PRODUCTION' as const, name: 'Syed Muslim' },
    { username: 'prod.syedrayyan', email: 'prod5@company.com', password, role: 'PRODUCTION' as const, name: 'Syed Rayyan' },
    { username: 'prod.tahiranwar', email: 'prod6@company.com', password, role: 'PRODUCTION' as const, name: 'Tahir Anwar' },
    { username: 'prod.muhammadbinsaud', email: 'prod7@company.com', password, role: 'PRODUCTION' as const, name: 'Muhammad Bin Saud' },
    { username: 'prod.qasimrizvi', email: 'prod8@company.com', password, role: 'PRODUCTION' as const, name: 'Qasim Rizvi' },
    { username: 'prod.syedakbar', email: 'prod9@company.com', password, role: 'PRODUCTION' as const, name: 'Syed Akbar' },
    { username: 'prod.anaskhan', email: 'prod10@company.com', password, role: 'PRODUCTION' as const, name: 'Anas Khan' },
    { username: 'prod.shakeebkhan', email: 'prod11@company.com', password, role: 'PRODUCTION' as const, name: 'Shakeeb Khan' },
  ];

  // Create TLs + team membership
  for (const u of tlUsers) {
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
    console.log(`✅ TL: ${user.name} → [${u.teams.join(', ')}]`);
  }

  // Create PMs + team membership
  for (const u of pmUsers) {
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
    console.log(`✅ PM: ${user.name} → [${u.teams.join(', ')}]`);
  }

  // Create Executives (no team membership — see all via role)
  for (const u of executiveUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { username: u.username, email: u.email, password: u.password, role: u.role, name: u.name },
    });
    console.log(`✅ EXEC: ${u.name} (no team — sees all)`);
  }

  // Create Production (no team membership — see assigned tasks cross-team)
  for (const u of productionUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { username: u.username, email: u.email, password: u.password, role: u.role, name: u.name },
    });
    console.log(`✅ PROD: ${u.name} (cross-team — sees assigned tasks)`);
  }

  console.log('\n✅ Database seeded successfully!');
  console.log('\n📋 Login Credentials (all passwords: password123):');
  console.log('\n🔹 Team Leads (2):');
  tlUsers.forEach((u) => console.log(`   ${u.username} → teams: ${u.teams.join(', ')}`));
  console.log('\n🔹 Project Managers (3):');
  pmUsers.forEach((u) => console.log(`   ${u.username} → team: ${u.teams[0]}`));
  console.log('\n🔹 Executives (see all workspaces):');
  executiveUsers.forEach((u) => console.log(`   ${u.username}`));
  console.log('\n🔹 Production (see assigned tasks from any team):');
  productionUsers.forEach((u) => console.log(`   ${u.username}`));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
