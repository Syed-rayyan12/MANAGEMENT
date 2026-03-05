import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Hash password for all users
  const password = await bcrypt.hash('password123', 10);

  // PM users (3)
  const pmUsers = [
    {
      username: 'pm.azharrajput',
      email: 'pm1@company.com',
      password,
      role: 'PM',
      name: 'Azhar Rajput',
    },
    {
      username: 'pm.aqsarathore',
      email: 'pm2@company.com',
      password,
      role: 'PM',
      name: 'Aqsa Rathore',
    },
    {
      username: 'pm.muhammadhuzafa',
      email: 'pm3@company.com',
      password,
      role: 'PM',
      name: 'Muhammad Huzafa',
    },
  ];

  // TL users
  const tlUsers = [
    {
      username: 'tl.mustufa',
      email: 'tl1@company.com',
      password,
      role: 'TL',
      name: 'Mustufa',
    },
    {
      username: 'tl.ali',
      email: 'tl2@company.com',
      password,
      role: 'TL',
      name: 'Ali',
    },
  ];

  // Executive users
  const executiveUsers = [
    {
      username: 'exec.muhammadmarij',
      email: 'exec1@company.com',
      password,
      role: 'EXECUTIVE',
      name: 'Muhammad Marij',
    },
    {
      username: 'exec.tahaanwar',
      email: 'exec2@company.com',
      password,
      role: 'EXECUTIVE',
      name: 'Taha Anwar',
    },
    {
      username: 'exec.khizerkhan',
      email: 'exec3@company.com',
      password,
      role: 'EXECUTIVE',
      name: 'Khizer Khan',
    },
    {
      username: 'exec.babarkhan',
      email: 'exec4@company.com',
      password,
      role: 'EXECUTIVE',
      name: 'Babar Khan',
    },
  ];

  // Production users
  const productionUsers = [
    { username: 'prod.abubakarsiddiqui', email: 'prod1@company.com', password, role: 'PRODUCTION', name: 'Abubakar Siddiqui' },
    { username: 'prod.arshanhasan', email: 'prod2@company.com', password, role: 'PRODUCTION', name: 'Arshan Hasan' },
    { username: 'prod.syedtaha', email: 'prod3@company.com', password, role: 'PRODUCTION', name: 'Syed Taha' },
    { username: 'prod.syedmuslim', email: 'prod4@company.com', password, role: 'PRODUCTION', name: 'Syed Muslim' },
    { username: 'prod.syedrayyan', email: 'prod5@company.com', password, role: 'PRODUCTION', name: 'Syed Rayyan' },
    { username: 'prod.tahiranwar', email: 'prod6@company.com', password, role: 'PRODUCTION', name: 'Tahir Anwar' },
    { username: 'prod.muhammadbinsaud', email: 'prod7@company.com', password, role: 'PRODUCTION', name: 'Muhammad Bin Saud' },
    { username: 'prod.qasimrizvi', email: 'prod8@company.com', password, role: 'PRODUCTION', name: 'Qasim Rizvi' },
    { username: 'prod.syedakbar', email: 'prod9@company.com', password, role: 'PRODUCTION', name: 'Syed Akbar' },
    { username: 'prod.anaskhan', email: 'prod10@company.com', password, role: 'PRODUCTION', name: 'Anas Khan' },
    { username: 'prod.shakeebkhan', email: 'prod11@company.com', password, role: 'PRODUCTION', name: 'Shakeeb Khan' },
  ];

  const allUsers = [...pmUsers, ...tlUsers, ...executiveUsers, ...productionUsers];

  console.log('Creating users...');
  
  for (const userData of allUsers) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: userData as any,
    });
    console.log(`✅ Created user: ${user.email} (${user.role})`);
  }

  console.log('\n✅ Database seeded successfully!');
  console.log('\n📋 Login Credentials (all passwords: password123):');
  console.log('\n🔹 Project Managers (3):');
  pmUsers.forEach((u) => console.log(`   ${u.email}`));
  console.log('\n🔹 Team Leads (2):');
  tlUsers.forEach((u) => console.log(`   ${u.email}`));
  console.log('\n🔹 Executives:');
  executiveUsers.forEach((u) => console.log(`   ${u.email}`));
  console.log('\n🔹 Production:');
  productionUsers.forEach((u) => console.log(`   ${u.email}`));
  console.log('\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
