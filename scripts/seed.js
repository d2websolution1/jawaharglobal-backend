import dotenv from 'dotenv';
import sequelize from '../config/db.js';
import Page from '../models/Page.js';
import Gallery from '../models/Gallery.js';
import TeamMember from '../models/TeamMember.js';
import Course from '../models/Course.js';
import CourseModule from '../models/CourseModule.js';

dotenv.config();

const run = async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });

    // Pages
    await Page.upsert({
      slug: 'home',
      title: 'Jawahar Global Foundation',
      content: `<h2>Welcome to Jawahar Global Foundation</h2><p>Together for a better tomorrow.</p>`,
    });

    await Page.upsert({
      slug: 'about',
      title: 'About Us',
      content: `<h2>About Jawahar Global Foundation</h2><p>Our mission and vision...</p>`,
    });

    await Page.upsert({
      slug: 'contact',
      title: 'Contact',
      content: `<h2>Contact Us</h2><p>Reach out with queries or support.</p>`,
    });
    await Page.upsert({
      slug: 'mission',
      title: 'Mission & Vision',
      content: `<h2>Mission & Vision</h2><p>To empower communities through education, health, and sustainable development.</p>`,
    });
    await Page.upsert({
      slug: 'team',
      title: 'Our Team',
      content: `<h2>Our Team</h2><p>Dedicated leaders and volunteers driving social change.</p>`,
    });
    await Page.upsert({
      slug: 'education',
      title: 'Education',
      content: `<h2>Education Programs</h2><p>Supporting learners with scholarships and skill training.</p>`,
    });
    await Page.upsert({
      slug: 'health',
      title: 'Health Care',
      content: `<h2>Health Care</h2><p>Providing access to medical camps and health awareness activities.</p>`,
    });
    await Page.upsert({
      slug: 'women',
      title: 'Women Empowerment',
      content: `<h2>Women Empowerment</h2><p>Encouraging women through skill-building and entrepreneurship support.</p>`,
    });
    await Page.upsert({
      slug: 'environment',
      title: 'Environment',
      content: `<h2>Environment</h2><p>Driving tree plantations and sustainable community programs.</p>`,
    });

    // Gallery sample
    await Gallery.upsert({
      title: 'Foundation Event 1',
      imageUrl: 'https://via.placeholder.com/640x480?text=Gallery+Image+1',
      description: 'Event photo',
    });
    await Gallery.upsert({
      title: 'Foundation Event 2',
      imageUrl: 'https://via.placeholder.com/640x480?text=Gallery+Image+2',
      description: 'Community outreach',
    });

    // Team sample
    await TeamMember.upsert({
      name: 'John Doe',
      role: 'Founder',
      bio: 'Founder bio',
      photoUrl: 'https://via.placeholder.com/240?text=Founder',
    });

    // Courses + Modules
    const courseSeeds = [
      {
        slug: 'salon',
        title: 'Salon Skills (Basics to Employability)',
        description: 'Learn salon fundamentals, hygiene, customer communication, and practical styling workflow.',
        level: 'Beginner',
        coverImageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTgPtalOPAGP1lZ8O5GTBrt8NrjKBnjjKhuHGjvuf-opg&s=10',
        durationHours: 6,
      },
      {
        slug: 'parlour',
        title: 'Parlour Skills (Care & Customer Experience)',
        description: 'A structured course on skin/hair care routines, safety, and professional service standards.',
        level: 'Beginner',
        coverImageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRLmnKwaw_1rXlLd2DVYbAh6G1FsgXhnpUjRWFVseNJAQ&s=10',
        durationHours: 6,
      },
      {
        slug: 'electrician',
        title: 'Electrician Fundamentals (Safety First)',
        description: 'Understand electrical safety, basic tools, wiring concepts, and safe troubleshooting approach.',
        level: 'Beginner',
        coverImageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRRb-Lf33ysvK2w_tiiToW6GADSoKiayVCaSkW3Pg5AZw&s=10',
        durationHours: 8,
      },
      {
        slug: 'machanic',
        title: 'Mechanic Basics (Service & Diagnostics)',
        description: 'Learn maintenance workflow, diagnostics mindset, and safe workshop practices.',
        level: 'Beginner',
        coverImageUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS4b6-0o8pA67yqN01wHdB2Aaza7uQ_jhKnGj2srDNKxw&s=10',
        durationHours: 8,
      },
    ];

    for (const c of courseSeeds) {
      await Course.upsert(c);
    }

    const moduleSeeds = [
      // salon
      { courseSlug: 'salon', orderIndex: 1, title: 'Orientation & Salon Hygiene', content: 'Hygiene, sanitation, tool safety, and workspace setup.' },
      { courseSlug: 'salon', orderIndex: 2, title: 'Hair Types & Consultation', content: 'Customer consultation, hair analysis, and selecting suitable services.' },
      { courseSlug: 'salon', orderIndex: 3, title: 'Styling Workflow', content: 'Step-by-step styling workflow, finishing, and customer handover.' },

      // parlour
      { courseSlug: 'parlour', orderIndex: 1, title: 'Care Basics & Safety', content: 'Client safety, sanitation standards, and basic care routines.' },
      { courseSlug: 'parlour', orderIndex: 2, title: 'Professional Service Standards', content: 'Customer experience, timing, communication, and service consistency.' },
      { courseSlug: 'parlour', orderIndex: 3, title: 'Product Knowledge', content: 'Understanding common products, usage guidelines, and label basics.' },

      // electrician
      { courseSlug: 'electrician', orderIndex: 1, title: 'Electrical Safety', content: 'Safety fundamentals, PPE basics, and hazard awareness.' },
      { courseSlug: 'electrician', orderIndex: 2, title: 'Tools & Basic Wiring Concepts', content: 'Common tools, simple wiring concepts, and practical understanding.' },
      { courseSlug: 'electrician', orderIndex: 3, title: 'Troubleshooting Mindset', content: 'How to approach diagnostics safely and systematically.' },

      // machanic
      { courseSlug: 'machanic', orderIndex: 1, title: 'Workshop Safety & Setup', content: 'Workshop safety, basic equipment, and safe work practices.' },
      { courseSlug: 'machanic', orderIndex: 2, title: 'Maintenance Workflow', content: 'Service steps, inspection checklist, and routine maintenance approach.' },
      { courseSlug: 'machanic', orderIndex: 3, title: 'Diagnostics Basics', content: 'Identifying common issues and basic diagnostics workflow.' },
    ];

    for (const m of moduleSeeds) {
      await CourseModule.create(m).catch(async () => {
        // if already exists, ignore (simple for this seed)
      });
    }

    console.log('Seeding completed');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();

