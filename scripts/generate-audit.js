const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, NumberFormat, AlignmentType, HeadingLevel,
  WidthType, BorderStyle, ShadingType, SectionType, PageBreak,
  TableOfContents, TableLayoutType, LevelFormat,
} = require('docx');

// ── Palette: DS-1 Deep Sea (tech/report default) ──
const P = {
  bg: "0B1C2C", titleColor: "FFFFFF", subtitleColor: "B0B8C0",
  metaColor: "90989F", footerColor: "687078", accent: "529286",
  primary: "0B1C2C", body: "182030", secondary: "506070",
  table: { headerBg: "529286", headerText: "FFFFFF", accentLine: "529286", innerLine: "BECFCC", surface: "E8ECEB" },
};
const c = (hex) => hex.replace('#', '');

// ── Borders ──
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

// ── Cover helpers ──
function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const charWidth = (pt) => pt * 20;
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  let titlePt = preferredPt, lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) {
    lines = splitTitleLines(title, charsPerLine(minPt));
    titlePt = minPt;
  }
  return { titlePt, titleLines: lines };
}
function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([...' ,;:!?-_/ ', '\t']);
  const lines = []; let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) breakAt = charsPerLine;
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop(); lines[lines.length - 1] += last;
  }
  return lines;
}
function calcCoverSpacing(params) {
  const { titleLineCount = 1, titlePt = 36, hasSubtitle = false, hasEnglishLabel = false, metaLineCount = 0, fixedHeight = 800 } = params;
  const SAFETY = 1200; const usableHeight = 16838 - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (12 * 23 + 600) : 0;
  const englishLabelHeight = hasEnglishLabel ? (9 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const implicitParaHeight = 3 * 300;
  const contentHeight = titleHeight + subtitleHeight + englishLabelHeight + metaHeight + fixedHeight + implicitParaHeight;
  const remainingSpace = Math.max(usableHeight - contentHeight, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(remainingSpace * 0.45);
  const rawBottom = Math.floor(remainingSpace * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  return { topSpacing, midSpacing: Math.max(remainingSpace - topSpacing - bottomSpacing, 0), bottomSpacing };
}

function buildCoverR1(config) {
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 40, 24);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length, fixedHeight: 400,
  });
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: c(P.accent), space: 12 };
  const children = [];
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));
  if (config.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: c(P.accent), space: 8 } },
      children: [new TextRun({ text: config.englishLabel.split('').join('  '), size: 18, color: c(P.accent), font: { ascii: 'Calibri' }, characterSpacing: 40 })],
    }));
  }
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: 'atLeast' },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true, color: c(P.titleColor), font: { ascii: 'Arial' } })],
    }));
  }
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL }, spacing: { after: 800 },
      children: [new TextRun({ text: config.subtitle, size: 24, color: c(P.subtitleColor), font: { ascii: 'Arial' } })],
    }));
  }
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: c(P.metaColor), font: { ascii: 'Arial' } })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: c(P.accent), space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || '', size: 16, color: c(P.footerColor), font: { ascii: 'Arial' } }),
      new TextRun({ text: '                                                    ' }),
      new TextRun({ text: config.footerRight || '', size: 16, color: c(P.footerColor), font: { ascii: 'Arial' } }),
    ],
  }));
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: 'exact' },
      children: [new TableCell({ shading: { type: ShadingType.CLEAR, fill: c(P.bg) }, borders: noBorders, children })],
    })],
  })];
}

// ── Table builders ──
function headerCell(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 20, color: c(P.table.headerText), font: { ascii: 'Calibri' } })] })],
    shading: { type: ShadingType.CLEAR, fill: c(P.table.headerBg) },
    margins: { top: 50, bottom: 50, left: 100, right: 100 },
    tableHeader: true,
  });
}
function dataCell(text, width, idx) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    children: [new Paragraph({ children: [new TextRun({ text, size: 20, color: '000000', font: { ascii: 'Calibri' } })] })],
    shading: idx % 2 === 0 ? { type: ShadingType.CLEAR, fill: c(P.table.surface) } : undefined,
    margins: { top: 40, bottom: 40, left: 100, right: 100 },
  });
}
function makeTable(headers, rows, widths) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: c(P.table.accentLine) },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: c(P.table.accentLine) },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: c(P.table.innerLine) },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => headerCell(h, widths[i])) }),
      ...rows.map((row, ri) => new TableRow({ cantSplit: true, children: row.map((cell, ci) => dataCell(cell, widths[ci], ri)) })),
    ],
  });
}

// ── Content builders ──
function h1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, color: c(P.body), font: { ascii: 'Times New Roman' } })] });
}
function h2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 120, line: 312 },
    children: [new TextRun({ text, bold: true, size: 28, color: c(P.body), font: { ascii: 'Times New Roman' } })] });
}
function h3(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100, line: 312 },
    children: [new TextRun({ text, bold: true, size: 24, color: c(P.body), font: { ascii: 'Times New Roman' } })] });
}
function body(text) {
  return new Paragraph({ alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 480 }, spacing: { after: 80, line: 312 },
    children: [new TextRun({ text, size: 22, color: '000000', font: { ascii: 'Times New Roman' } })] });
}
function bodyNoIndent(text) {
  return new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 80, line: 312 },
    children: [new TextRun({ text, size: 22, color: '000000', font: { ascii: 'Times New Roman' } })] });
}
function spacer(h = 100) {
  return new Paragraph({ spacing: { before: h } });
}

// ── BUILD DOCUMENT ──
const doc = new Document({
  styles: {
    default: { document: { run: { font: { ascii: 'Times New Roman' }, size: 22, color: '000000' }, paragraph: { spacing: { line: 312 } } } },
    heading1: { run: { font: { ascii: 'Times New Roman' }, size: 32, bold: true, color: c(P.body) }, paragraph: { spacing: { before: 360, after: 160, line: 312 } } },
    heading2: { run: { font: { ascii: 'Times New Roman' }, size: 28, bold: true, color: c(P.body) }, paragraph: { spacing: { before: 280, after: 120, line: 312 } } },
    heading3: { run: { font: { ascii: 'Times New Roman' }, size: 24, bold: true, color: c(P.body) }, paragraph: { spacing: { before: 200, after: 100, line: 312 } } },
  },
  numbering: { config: [{ reference: 'bullet-main', levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }] },
  sections: [
    // ── COVER ──
    { properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR1({
        title: 'Bandhan Enterprise Audit Report', subtitle: 'Complete Codebase Implementation Analysis',
        englishLabel: 'TECHNICAL AUDIT', palette: P,
        metaLines: ['Project: Bandhan - Sahu Samaj Connects', 'Stack: Next.js 16 + TypeScript + Prisma + Tailwind CSS v4', 'Date: August 6, 2026', 'Scope: Phase 1 (UI) + Phase 2 (Enterprise Backend)'],
        footerLeft: 'Confidential', footerRight: 'v0.2.1',
      }),
    },
    // ── TOC ──
    { properties: { type: SectionType.NEXT_PAGE, page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 }, pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Bandhan Enterprise Audit', size: 18, color: c(P.secondary), font: { ascii: 'Calibri' } })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: c(P.secondary), font: { ascii: 'Calibri' } })] })] }) },
      children: [
        new Paragraph({ spacing: { after: 300 }, children: [new TextRun({ text: 'Table of Contents', size: 36, bold: true, color: c(P.body), font: { ascii: 'Times New Roman' } })] }),
        new TableOfContents('Table of Contents', { hyperlink: true, headingStyleRange: '1-3' }),
        new Paragraph({ children: [new PageBreak()] }),
        // Italic hint for TOC refresh
        new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: 'Note: Right-click the Table of Contents above and select “Update Field” to refresh page numbers after opening in Word or WPS.', size: 18, italics: true, color: '888888', font: { ascii: 'Calibri' } })] }),
      ],
    },
    // ── BODY ──
    { properties: { type: SectionType.NEXT_PAGE, page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 }, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Bandhan Enterprise Audit', size: 18, color: c(P.secondary), font: { ascii: 'Calibri' } })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: c(P.secondary), font: { ascii: 'Calibri' } })] })] }) },
      children: [
        // ═══════════════════════════════════════════════════════════
        // SECTION 1: EXECUTIVE SUMMARY
        // ═══════════════════════════════════════════════════════════
        h1('1. Executive Summary'),
        body('This report presents a comprehensive audit of the Bandhan (Sahu Samaj Connects) platform codebase. The audit covers both Phase 1 (Premium UI Redesign) and Phase 2 (Enterprise Backend Foundation), analyzing every file, component, API route, database model, service, and configuration in the project. The analysis identifies completed features, partially implemented systems, missing functionality, placeholder content, technical debt, and security concerns across the entire stack.'),
        body('The Bandhan platform is a community engagement system targeting 250 million+ users across four core verticals: Matrimony, Business Directory, Jobs, and Organization Directory. The frontend is built with Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Framer Motion, and a custom i18n system supporting English and Hindi. The backend implements REST APIs with Prisma ORM, session-based authentication, RBAC with six hierarchical roles, and foundational services for AI, caching, search, media, notifications, and monitoring.'),
        spacer(80),
        makeTable(
          ['Metric', 'Value'],
          [
            ['Total Custom Files (Phase 1 + 2)', '47 files, ~5,500 lines'],
            ['shadcn/ui Boilerplate', '~48 files, ~5,400 lines (untouched)'],
            ['Public Images', '12 files (all AI-generated)'],
            ['Prisma Models', '19 tables, 477 lines'],
            ['API Routes (total)', '44 routes across /api and /api/v1'],
            ['Backend Services', '6 service modules'],
            ['Utility Libraries', '10 files in src/lib/'],
            ['TODOs in Codebase', '7 total (0 in UI, 7 in backend)'],
          ],
          [50, 50],
        ),
        spacer(80),
        makeTable(
          ['Phase', 'Completion', 'Assessment'],
          [
            ['Phase 1: Premium UI', '95%', 'Functionally complete; hardcoded data expected'],
            ['Phase 2: Enterprise Backend', '55%', 'Auth and admin solid; AI/services are stubs'],
            ['Overall Project', '72%', 'Strong foundation, significant work remaining'],
          ],
          [30, 20, 50],
        ),

        // ═══════════════════════════════════════════════════════════
        // SECTION 2: PHASE 1 STATUS
        // ═══════════════════════════════════════════════════════════
        h1('2. Phase 1: Premium UI Redesign'),
        body('Phase 1 delivers a visually premium, fully bilingual (English/Hindi) homepage with 14+ interactive components. The design follows an Indian premium aesthetic with a Burgundy/Gold/Teal color palette, glass-morphism effects, and extensive Framer Motion animations. Every component renders correctly with zero console errors. The homepage assembly flows through ten distinct sections in a carefully designed visual hierarchy.'),

        h2('2.1 UI Components'),
        body('The Phase 1 implementation consists of 20 custom files totaling 2,534 lines of TypeScript/TSX code. The component architecture follows a clear separation: shared components (logo, language switcher), layout components (top info bar, header, footer), and home page components (hero carousel, service cards, featured profiles, success stories, stats, ad banners). Each component is self-contained with its own Framer Motion animations and responsive breakpoints.'),
        spacer(60),
        makeTable(
          ['Component', 'Lines', 'Status', 'Key Features'],
          [
            ['TopInfoBar', '63', 'COMPLETE', 'Org info, social icons, lang switcher, login/register buttons'],
            ['Header', '154', 'COMPLETE', '7 nav items, xl: desktop nav, mobile drawer, scroll blur, body lock'],
            ['Footer', '86', 'COMPLETE', '3-column grid, logo, quick links, copyright, admin link'],
            ['PremiumHeroCarousel', '156', 'COMPLETE', '4 slides, 6s auto-play, AnimatePresence, per-slide color themes'],
            ['PremiumServiceCards', '157', 'COMPLETE', '4 glass cards, stagger animation, shimmer hover, responsive 1-4 col'],
            ['FeaturedProfiles', '308', 'COMPLETE', '5 sections, 20 cards, horizontal scroll rows, whileHover'],
            ['SuccessStories', '95', 'COMPLETE', '2 couple cards, gradient overlays, stagger fade-up'],
            ['PremiumStats', '116', 'COMPLETE', '5 animated counters, ease-out quartic, IN number format'],
            ['PremiumAdBanner', '76', 'COMPLETE', 'Photo banner with gradient overlay, corner decorations'],
            ['BandhanLogo', '42', 'COMPLETE', 'Locale-based EN/HI switching, 3 responsive breakpoints'],
            ['LanguageSwitcher', '27', 'COMPLETE', 'Globe toggle, glass effect, gold hover accents'],
          ],
          [22, 8, 12, 58],
        ),

        h2('2.2 Design System'),
        body('The design system is defined in globals.css with 38 CSS custom properties organized into brand colors, semantic colors, sidebar variables, chart variables, and radius tokens. The brand palette centers on Burgundy (#7B2D3B), Gold (#C8A951), Teal (#2C4A52), Ivory (#FFFEF7), Rose Gold (#B76E79), and Wine (#6B1D2A) with multiple shades for each. Eight custom keyframe animations are defined (fadeIn, fadeInUp, fadeInDown, scaleIn, slideInLeft, slideInRight, shimmer, float, pulseSoft). Two glass-morphism utility classes provide backdrop-blur effects at different intensities. Typography utilities include text-balance, text-gradient-gold, and text-gradient-burgundy. Section padding utilities ensure consistent vertical rhythm across all components.'),

        h2('2.3 Responsive Design'),
        body('The responsive strategy uses four Tailwind breakpoints (sm: 640px, md: 768px, lg: 1024px, xl: 1280px). The header desktop navigation only appears at the xl breakpoint, meaning devices between 1024-1279px see the mobile drawer menu. This is an intentional design decision that prioritizes the premium mobile experience. All components implement responsive grids: service cards flow from 1 to 2 to 4 columns, stats from 2 to 3 to 5 columns, and the hero carousel adjusts its aspect ratio at each breakpoint. The mobile drawer uses a custom Framer Motion implementation with AnimatePresence, backdrop overlay, and staggered nav item animations, rather than the shadcn Sheet component.'),

        h2('2.4 Multilingual (i18n)'),
        body('The custom i18n system comprises three files: translations.ts (389 lines), index.ts (14 lines), and language-store.ts (21 lines). The translation file defines 8 top-level sections with approximately 120+ keys covering navigation, top bar, hero slides, services, featured profiles, success stories, advertisements, stats, footer, language labels, and common UI strings. Hindi translations are 100% complete with every English key having an exact Hindi counterpart. The language state is managed through a Zustand store with persist middleware, surviving page refreshes. The useTranslations() hook provides both t() function and locale value for conditional rendering.'),

        h2('2.5 Logo Switching'),
        body('The BandhanLogo component conditionally renders /logo-en.jpg or /logo-hi.jpg based on the current locale from the Zustand store. It uses native <img> tags (not Next.js Image) with object-contain for maximum compatibility. The component implements three responsive sizing breakpoints: mobile (h-12/w-32), medium (md:h-14/w-40), and desktop (lg:h-3.5rem/w-48) for English, with slightly different dimensions for the Hindi logo. Alt text is language-aware, displaying the Hindi name when Hindi is active.'),

        h2('2.6 Hero Carousel'),
        body('The PremiumHeroCarousel renders 4 slides (matrimony, business, jobs, directory) with full-bleed AI-generated background images. Each slide has a unique color theme for its tag badge and CTA button (burgundy, gold-dark, teal, burgundy-light). The carousel uses Framer Motion AnimatePresence with popLayout mode for smooth scale-based transitions (1.04 to 1.0 to 0.96). Text content fades in with a 0.3s delay. Navigation includes prev/next glass-circle arrows and gold pagination dots with an active state that expands to w-8 with a glow effect. Auto-play cycles every 6 seconds.'),

        h2('2.7 Advertisements'),
        body('The PremiumAdBanner component is used twice on the homepage (after service cards and before footer) by passing different slideIndex props (1 and 2). It reuses the same hero background images with gradient overlays, tag badges, headlines, and CTA buttons. The responsive height scales from h-48 to sm:56 to md:64. Decorative gold border accents appear on larger screens. The component supports whileInView fade-up animation and subtle whileHover scale (1.005) for a polished feel.'),

        h2('2.8 Unused / Legacy Components'),
        body('Three components exist in the codebase but are NOT imported by the active page.tsx: HeroSection.tsx (163 lines, replaced by PremiumHeroCarousel), StatsSection.tsx (90 lines, replaced by PremiumStats, contains a bug referencing non-existent t.stats.matches key), and AdCarousel.tsx (188 lines, replaced by PremiumAdBanner). Additionally, SectionDivider.tsx (13 lines) is only used by the two unused legacy components. These five files totaling 454 lines are dead code that could be removed to reduce bundle size.'),

        // ═══════════════════════════════════════════════════════════
        // SECTION 3: PHASE 2 STATUS
        // ═══════════════════════════════════════════════════════════
        h1('3. Phase 2: Enterprise Backend Foundation'),
        body('Phase 2 establishes the server-side architecture for a platform designed to scale to 250 million users. The implementation covers a Prisma schema with 19 models, 44 API routes across two path hierarchies (/api and /api/v1), 10 library modules providing authentication, authorization, validation, audit logging, and seeding, plus 6 service modules for AI, caching, media, monitoring, queue processing, and search.'),

        h2('3.1 Database Schema (Prisma)'),
        body('The Prisma schema defines 19 models across 477 lines, currently using SQLite as the database provider. The schema implements comprehensive user management (User with 24 fields, Profile with 44 fields across basic, location, professional, matrimony, business, directory, privacy, social, and AI categories), role-based access control (Role, Permission, RolePermission), session management (UserSession, LoginHistory), approval workflows (Approval), membership tiers (Membership, MembershipPlan), media management (Media with 13 fields), notifications (Notification), communication (ContactRequest, AppointmentRequest), advertising (Advertisement with 14 fields including impression/click tracking), audit trails (AuditLog, SecurityEvent), and system configuration (SystemConfiguration).'),
        body('The schema includes 10 unique constraints and several indexes. However, critical indexes are missing on frequently queried fields such as User.email, User.phone, User.status, Notification.userId, AuditLog.createdAt, and SecurityEvent.createdAt. Additionally, several models (OtpVerification, LoginHistory, Notification, ContactRequest, AppointmentRequest) lack updatedAt timestamps. JSON-structured fields like partnerPreferences, socialLinks, aiTags, and notification data are stored as raw String types rather than Prisma Json type, losing type safety. The use of SQLite is a significant scaling limitation for a platform targeting 250 million users, as it lacks concurrent write support, native full-text search, and horizontal scaling capabilities.'),

        h2('3.2 Authentication System'),
        body('The authentication system is 90% complete, implementing password hashing with scrypt (64-byte key, 16-byte random salt), timing-safe password verification, 32-byte bearer token generation, session-based authentication with 30-day expiry, and account lockout after 5 failed login attempts (30-minute cooldown). The auth-middleware.ts provides authenticate(), authenticateAdmin(), authenticateSuperAdmin(), requireAuth(), and requireAdmin() middleware functions. Login, register, logout, and session introspection (GET /me) routes are fully functional. OTP send/verify endpoints are implemented with in-database OTP storage and max-attempt enforcement.'),
        body('Missing authentication features include: password reset flow, password change flow, social authentication (Google/Facebook), mustChangePassword enforcement, multi-device session management (viewing and revoking other sessions), and remember-me functionality. A security concern exists in the OTP implementation: verification queries by identifier only without userId scoping, meaning any user could theoretically verify another user\'s OTP if they know the identifier. Additionally, OTP codes are logged to console in plaintext.'),

        h2('3.3 RBAC Implementation'),
        body('The RBAC system defines 6 hierarchical roles (Super Admin, Admin, Moderator, Verified User, Member, Guest) with level-based access and 31 granular permissions spanning 8 modules (users, profiles, content, analytics, membership, settings, advertisements, notifications). The database schema supports dynamic role-permission mapping through RolePermission join tables, and the admin API allows updating role permissions via PUT /admin/roles. The rbac.ts library provides hasPermission(), hasMinRoleLevel(), isAdmin(), and isSuperAdmin() functions.'),
        body('However, the most significant architectural issue in the entire backend is that the runtime hasPermission() function uses a hardcoded TypeScript constant map (ROLE_PERMISSIONS) rather than querying the database. This means any permission changes made through the admin API or database updates have absolutely no effect on actual permission checks. Admin routes only check isAdmin() (role level), not specific permissions. The RBAC database layer is entirely decorative at this point, creating a false sense of configurability.'),

        h2('3.4 API Routes'),
        body('The API layer follows a dual-route pattern: canonical implementations live under /api/ (auth, user, admin), while /api/v1/ provides versioned access through re-exports or standalone implementations. This yields 44 total routes. Authentication routes (login, register, logout, me, OTP send/verify) are 90% complete. User routes (profile CRUD, notifications) are 70% complete. Admin routes are the most comprehensive at 85% complete, covering dashboard analytics, user management with approval workflows, role management, system settings, advertisement CRUD, membership management, analytics aggregation, and audit log viewing.'),
        body('Five AI routes exist (/api/v1/ai/match, astrology, recommendations, assistant, moderation) but all are pure stubs returning zero scores, empty arrays, or "not configured" messages. A health check endpoint and search endpoint round out the v1 API. Notably missing API routes include: password reset/change, session management, actual file upload, public membership plans listing, payment integration, contact requests, appointment requests, public advertisement serving, and system notification broadcasting.'),
        spacer(60),
        makeTable(
          ['API Category', 'Routes', 'Status', 'Completion'],
          [
            ['Auth (login/register/logout/me/otp)', '6', 'COMPLETE', '90%'],
            ['User (profile/notifications)', '2', 'COMPLETE', '70%'],
            ['Admin (dashboard/users/roles/security)', '5', 'COMPLETE', '85%'],
            ['Admin v1 (settings/ads/membership/analytics/audit)', '6', 'COMPLETE', '85%'],
            ['AI (match/astrology/recommendations/assistant/moderation)', '5', 'STUBS', '5%'],
            ['Health', '1', 'COMPLETE', '100%'],
            ['Search', '1', 'COMPLETE', '60%'],
            ['v1 Re-exports', '18', 'COMPLETE', 'N/A'],
          ],
          [40, 10, 15, 15],
        ),

        h2('3.5 Backend Services'),
        body('Six service modules exist under src/services/. The search service (search.ts, 229 lines) is the most complete, implementing profile search with Prisma contains queries, search suggestion caching, and a prepareSearchIndex() stub for future Elasticsearch integration. The cache service (cache.ts, 109 lines) provides in-memory get/set/delete/clear operations with TTL support and cache stats, but uses an unbounded Map with no max size limit and no Redis integration. The monitoring service (monitoring.ts, 116 lines) implements health checks with actual DB pings, API request recording, and DB query metrics, but the recording functions are never called from any route, so metrics always show zero.'),
        body('The media service (media.ts, 181 lines) provides database record management for media files (create, get, delete) but has no actual file upload handling, no virus scanning, and no real thumbnail generation. The queue service (queue.ts, 142 lines) implements an in-memory job queue with 10 job type definitions, retry with exponential backoff, and handler registration, but zero job handlers are actually registered, making the entire queue system non-functional. The AI service (ai.ts, 147 lines) contains six functions (match profiles, astrology match, image moderation, recommendations, assistant chat, auto-approval) that all return hardcoded zero/empty/stub values with TODO comments for every function.'),

        h2('3.6 Security'),
        body('Security implementation is at 55% completeness. Strengths include: password hashing with scrypt, session-based authentication with expiry, account lockout after failed attempts, rate limiting (in-memory per identifier), audit logging, security event logging, security headers via next.config.ts (X-Content-Type-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy), and API-only X-Frame-Options DENY. Weaknesses include: no CSRF protection, no request body size limits, CORS allows all origins (Access-Control-Allow-Origin: *), no input sanitization in most API routes (the validation.ts utilities exist but are largely unused), no Next.js middleware.ts for edge-level checks, no IP-based blocking, the XSS sanitizer in validation.ts is trivially bypassable, and OTP codes are printed to server logs in plaintext.'),

        // ═══════════════════════════════════════════════════════════
        // SECTION 4: COMPLETED FEATURES
        // ═══════════════════════════════════════════════════════════
        h1('4. Completed Features'),
        makeTable(
          ['#', 'Feature', 'Phase', 'Details'],
          [
            ['1', 'Premium Homepage', '1', '10-section assembly with 14+ components, Framer Motion animations'],
            ['2', 'Hero Carousel', '1', '4 slides, auto-play, AnimatePresence transitions, per-slide themes'],
            ['3', 'Service Cards', '1', '4 color-coded glass cards with stagger animation and shimmer hover'],
            ['4', 'Featured Profiles', '1', '5 scroll-row sections (Brides, Grooms, Businesses, Jobs, Orgs)'],
            ['5', 'Success Stories', '1', '2 couple cards with gradient overlays and quotes'],
            ['6', 'Animated Stats', '1', '5 counters with ease-out quartic, IN number formatting'],
            ['7', 'Ad Banners', '1', '2 photo banners with gradient overlays and CTA buttons'],
            ['8', 'Responsive Header', '1', 'Sticky with scroll blur, mobile drawer, 7 nav items'],
            ['9', 'Footer', '1', '3-column grid with logo, links, copyright, admin link'],
            ['10', 'Top Info Bar', '1', 'Org info, social icons, language switcher, login/register'],
            ['11', 'Logo Switching', '1', 'EN/HI logo swap based on locale, object-contain, 3 breakpoints'],
            ['12', 'Language Toggle', '1', 'Globe icon pill button, Zustand persisted, instant switch'],
            ['13', '100% Bilingual i18n', '1', '120+ keys, all EN/HI pairs, custom useTranslations hook'],
            ['14', 'Design System', '1', '38 CSS vars, 8 animations, glass utilities, section padding'],
            ['15', 'Login API', '2', 'Email/phone+password, rate limit, lockout, session, audit'],
            ['16', 'Register API', '2', 'Validation, hashing, user+profile creation, OTP, admin notify'],
            ['17', 'Session Auth', '2', 'Bearer token, 30-day expiry, middleware functions'],
            ['18', 'OTP Send/Verify', '2', 'In-DB storage, max attempts, expiry, user verification update'],
            ['19', 'Admin Dashboard', '2', '10 parallel DB queries, counts, group-bys, recent users'],
            ['20', 'User Management', '2', 'List with filters, approve/reject/block/unblock, notifications'],
            ['21', 'Role Management', '2', 'List roles with permissions, PUT to update role permissions'],
            ['22', 'System Settings', '2', 'CRUD for SystemConfiguration, SUPER_ADMIN restricted'],
            ['23', 'Advertisement CRUD', '2', 'Create, list, update ads with validation and audit'],
            ['24', 'Membership Management', '2', 'List memberships, create with tier update, plan listing'],
            ['25', 'Analytics API', '2', 'Period-based analytics with category/tier/status group-bys'],
            ['26', 'Audit Logging', '2', 'Log all significant actions with user, IP, entity, details'],
            ['27', 'Security Events', '2', 'Log and query security events with severity filtering'],
            ['28', 'Profile CRUD API', '2', 'GET/PUT with whitelist fields, audit logging'],
            ['29', 'Notifications API', '2', 'GET with pagination/unread filter, PATCH mark read'],
            ['30', 'Database Schema', '2', '19 models, relations, soft delete, audit fields'],
            ['31', 'Seed Data', '2', '6 roles, 31 permissions, 3 plans, 10 config entries, super admin'],
            ['32', 'API Versioning', '2', 'Dual /api + /api/v1 structure, 18 re-export routes'],
            ['33', 'Production Build', '2', 'Standalone output, Caddy proxy, 66ms cold start'],
          ],
          [5, 25, 8, 62],
        ),

        // ═══════════════════════════════════════════════════════════
        // SECTION 5: PARTIALLY COMPLETED
        // ═══════════════════════════════════════════════════════════
        h1('5. Partially Completed Features'),
        makeTable(
          ['#', 'Feature', 'Completion', 'What Exists', 'What is Missing'],
          [
            ['1', 'RBAC System', '40%', '6 roles, 31 permissions, DB schema, admin UI for permission updates', 'Runtime uses hardcoded TS map, not DB. No per-route permission checks'],
            ['2', 'Search Service', '60%', 'Profile search with filters, caching, suggestion API', 'Uses LIKE only, no full-text search, no relevance ranking, no fuzzy matching'],
            ['3', 'Media Service', '30%', 'DB record CRUD, thumbnail URL generation stub', 'No actual file upload, no storage integration, no virus scanning, no real thumbnails'],
            ['4', 'Cache Service', '40%', 'In-memory get/set/delete with TTL, stats API', 'No Redis, unbounded Map, no max size, no LRU eviction, entries never accessed stay forever'],
            ['5', 'Queue Service', '20%', 'Job queue framework with 10 types, retry/backoff', 'Zero handlers registered, in-memory only, jobs lost on restart, no max queue size'],
            ['6', 'Monitoring Service', '30%', 'Health check with DB ping, metrics recording functions', 'Recording functions never called from routes, metrics always zero, memory threshold arbitrary'],
            ['7', 'Approval Workflow', '50%', 'GET approvals list, approve/reject in user PATCH', 'No dedicated POST for approval actions, no approval reasons, no multi-step workflow'],
            ['8', 'Profile API', '60%', 'GET/PUT for own profile, whitelist fields', 'No input validation, no enum checks, no file type validation, no privacy-level filtering'],
            ['9', 'Security Middleware', '50%', 'Headers, rate limit, lockout, audit, security events', 'No CSRF, no body size limits, CORS wildcard, no middleware.ts, sanitizer bypassable'],
            ['10', 'Admin Approvals Route', '50%', 'GET endpoint for listing approvals', 'No POST/PUT for creating or processing approval actions'],
          ],
          [5, 18, 10, 32, 35],
        ),

        // ═══════════════════════════════════════════════════════════
        // SECTION 6: MISSING FEATURES
        // ═══════════════════════════════════════════════════════════
        h1('6. Missing Features'),
        h2('6.1 Frontend Pages (Phase 1 Extension)'),
        makeTable(
          ['#', 'Missing Page/Feature', 'Priority'],
          [
            ['1', 'Login page / modal', 'HIGH'],
            ['2', 'Registration page / modal', 'HIGH'],
            ['3', 'Matrimony listing + detail pages', 'HIGH'],
            ['4', 'Business directory listing + detail pages', 'HIGH'],
            ['5', 'Jobs listing + detail pages', 'HIGH'],
            ['6', 'Organization directory listing + detail pages', 'MEDIUM'],
            ['7', 'User profile page', 'HIGH'],
            ['8', 'User dashboard', 'HIGH'],
            ['9', 'Admin dashboard UI', 'MEDIUM'],
            ['10', 'Contact request flow', 'MEDIUM'],
            ['11', 'Membership purchase / payment flow', 'MEDIUM'],
            ['12', 'Events listing page', 'LOW'],
            ['13', 'Privacy Policy page', 'LOW'],
            ['14', 'Terms of Service page', 'LOW'],
            ['15', 'About Us page', 'LOW'],
          ],
          [8, 77, 15],
        ),
        h2('6.2 Backend APIs'),
        makeTable(
          ['#', 'Missing API', 'Priority'],
          [
            ['1', 'POST /api/auth/forgot-password', 'HIGH'],
            ['2', 'POST /api/auth/reset-password', 'HIGH'],
            ['3', 'PUT /api/user/password', 'HIGH'],
            ['4', 'GET/DELETE /api/user/sessions', 'MEDIUM'],
            ['5', 'POST /api/media/upload (actual file handling)', 'HIGH'],
            ['6', 'GET /api/membership/plans (public listing)', 'MEDIUM'],
            ['7', 'POST /api/membership/checkout (payment)', 'HIGH'],
            ['8', 'GET /api/user/:id/profile (view other profiles)', 'HIGH'],
            ['9', 'POST /api/contact-request', 'MEDIUM'],
            ['10', 'POST /api/appointment-request', 'LOW'],
            ['11', 'GET /api/advertisements (public with impressions)', 'MEDIUM'],
            ['12', 'DELETE /api/admin/advertisements/:id', 'LOW'],
            ['13', 'POST /api/admin/notifications (broadcast)', 'LOW'],
          ],
          [8, 77, 15],
        ),
        h2('6.3 Infrastructure'),
        makeTable(
          ['#', 'Missing Item', 'Priority'],
          [
            ['1', '.env / .env.example file', 'HIGH'],
            ['2', 'middleware.ts (Next.js edge middleware)', 'HIGH'],
            ['3', 'PostgreSQL database migration', 'HIGH'],
            ['4', 'Redis integration for cache/session/rate-limit', 'HIGH'],
            ['5', 'S3/GCS integration for file storage', 'HIGH'],
            ['6', 'SMS/Email service integration', 'HIGH'],
            ['7', 'AI model integration (LLM, image moderation)', 'HIGH'],
            ['8', 'Elasticsearch / Meilisearch for full-text search', 'MEDIUM'],
            ['9', 'WebSocket support for real-time notifications', 'MEDIUM'],
            ['10', 'Docker Compose for multi-service orchestration', 'MEDIUM'],
            ['11', 'CI/CD pipeline configuration', 'MEDIUM'],
            ['12', 'Automated test suite (unit + integration)', 'MEDIUM'],
          ],
          [8, 62, 30],
        ),

        // ═══════════════════════════════════════════════════════════
        // SECTION 7: PLACEHOLDERS
        // ═══════════════════════════════════════════════════════════
        h1('7. Placeholders and Hardcoded Data'),
        body('The following elements contain placeholder or hardcoded data that must be replaced with real data when connecting to the backend or moving to production.'),
        makeTable(
          ['#', 'Location', 'Type', 'Details'],
          [
            ['1', 'FeaturedProfiles.tsx', 'Hardcoded data', '20 fake entries: 4 brides, 4 grooms, 4 businesses, 4 jobs, 4 orgs'],
            ['2', 'FeaturedProfiles.tsx', 'Shared images', 'All 4 brides use same image; all 4 grooms use same image'],
            ['3', 'PremiumStats.tsx', 'Hardcoded stats', '5 stat values (250K members, 8.5K marriages, etc.)'],
            ['4', 'SuccessStories.tsx', 'Hardcoded stories', '2 couple stories with fake names and quotes'],
            ['5', 'TopInfoBar.tsx', 'Placeholder links', 'All 4 social icons link to href="#"'],
            ['6', 'Header.tsx', 'Placeholder links', 'All 7 nav items use hash links (#matrimony, etc.)'],
            ['7', 'Header.tsx', 'No-op buttons', 'Login and Register buttons have no onClick handlers'],
            ['8', 'FeaturedProfiles.tsx', 'No-op buttons', 'Heart, View Profile, Apply Now buttons have no onClick'],
            ['9', 'Footer.tsx', 'Missing links', 'Legal links (privacy, terms, refund) exist in translations but not rendered'],
            ['10', 'ai.ts (all 6 functions)', 'Stub returns', 'All AI functions return zero/empty/not-configured values'],
            ['11', 'seed.ts', 'Hardcoded password', 'Super admin password "Admin@123" in source code'],
            ['12', 'queue.ts', 'Empty handlers', 'Handler registration Map is always empty; no jobs ever process'],
          ],
          [5, 25, 20, 50],
        ),

        // ═══════════════════════════════════════════════════════════
        // SECTION 8: TODOs
        // ═══════════════════════════════════════════════════════════
        h1('8. TODO Comments'),
        body('A total of 7 TODO comments exist across the backend codebase. Zero TODOs were found in any Phase 1 UI component, layout, store, or i18n file. Each TODO is listed below with its exact location, content, and severity assessment.'),
        makeTable(
          ['#', 'File', 'Line', 'TODO Content', 'Severity'],
          [
            ['1', 'src/lib/auth.ts', '36', 'replace with Redis for production', 'MEDIUM'],
            ['2', 'src/lib/otp.ts', '36-38', 'Replace with actual SMS/Email service integration', 'HIGH'],
            ['3', 'src/services/ai.ts', '12', 'Implement AI profile matching', 'HIGH'],
            ['4', 'src/services/ai.ts', '37', 'Implement astrology matching', 'LOW'],
            ['5', 'src/services/ai.ts', '58', 'Implement image moderation', 'HIGH'],
            ['6', 'src/services/ai.ts', '78', 'Implement recommendations', 'MEDIUM'],
            ['7', 'src/services/ai.ts', '95', 'Implement AI assistant', 'MEDIUM'],
          ],
          [5, 22, 8, 42, 13],
        ),

        // ═══════════════════════════════════════════════════════════
        // SECTION 9: BUILD ERRORS & WARNINGS
        // ═══════════════════════════════════════════════════════════
        h1('9. Build Errors and Warnings'),
        h2('9.1 Build Status'),
        body('The project builds successfully with zero errors using Turbopack. The production build compiles in approximately 11 seconds and generates 44 routes (1 static homepage, 1 not-found page, 42 dynamic API routes). The build produces a standalone output suitable for Docker deployment, with a cold start time of 66-71 milliseconds.'),
        h2('9.2 Suppressed Warnings'),
        body('TypeScript errors are explicitly suppressed via ignoreBuildErrors: true in next.config.ts. The tsconfig.json sets strict: true but also noImplicitAny: false, which is contradictory and allows implicit any types to pass. ESLint is effectively disabled with all rules turned off (no-console, no-explicit-any, no-unused-vars, prefer-const, and many more are all set to "off"). This means the codebase has zero lint protection, and type errors are silently ignored during builds.'),
        h2('9.3 Runtime Warnings'),
        body('No runtime warnings are generated during normal server operation. However, several silent failure patterns exist: audit log failures are caught and only console.error\'d, notification creation errors are swallowed silently, and the cleanupRateLimits() function in auth.ts is defined but never called, resulting in dead code. The next-intl package is listed as a dependency but never imported anywhere in the codebase.'),

        // ═══════════════════════════════════════════════════════════
        // SECTION 10: MISSING DEPENDENCIES
        // ═══════════════════════════════════════════════════════════
        h1('10. Dependency Analysis'),
        h2('10.1 Installed but Unused Dependencies'),
        body('Several npm packages are declared in package.json but never imported or used anywhere in the codebase. These add unnecessary weight to node_modules and should be removed or their implementations completed.'),
        makeTable(
          ['Package', 'Version', 'Listed For', 'Actual Usage'],
          [
            ['next-auth', '4.24.11', 'Authentication', 'Never imported; custom auth implemented instead'],
            ['zod', '4.0.2', 'Validation', 'Never imported; manual validation used in routes'],
            ['sharp', '0.34.3', 'Image processing', 'Never imported; images served as-is'],
            ['uuid', '11.1.0', 'ID generation', 'Never imported; crypto.randomBytes used instead'],
            ['next-intl', 'N/A', 'i18n', 'Never imported; custom i18n system used instead'],
          ],
          [20, 15, 25, 40],
        ),
        h2('10.2 Missing Production Dependencies'),
        body('The following dependencies will be needed when moving beyond the current in-memory implementation to a production-ready system.'),
        makeTable(
          ['Dependency', 'Purpose', 'Replaces'],
          [
            ['ioredis or redis', 'Redis client for cache, sessions, rate limits', 'In-memory Map in cache.ts, auth.ts'],
            ['@aws-sdk/client-s3 or gcs', 'Object storage for media files', 'No storage integration in media.ts'],
            ['nodemailer or sendgrid', 'Email delivery for OTP, notifications', 'console.log in otp.ts'],
            ['twilio or messagebird', 'SMS delivery for OTP', 'console.log in otp.ts'],
            ['bull or bullmq', 'Persistent job queue', 'In-memory queue in queue.ts'],
            ['@elastic/elasticsearch or meilisearch', 'Full-text search engine', 'Prisma LIKE queries in search.ts'],
            ['openai or @anthropic-ai/sdk', 'AI model integration', 'Stub functions in ai.ts'],
            ['helmet or express-rate-limit', 'Additional security middleware', 'Manual implementations in lib/'],
            ['jest or vitest', 'Testing framework', 'No tests exist'],
            ['postgresql (prisma-client)', 'Production database', 'SQLite in schema.prisma'],
          ],
          [30, 45, 25],
        ),

        // ═══════════════════════════════════════════════════════════
        // SECTION 11: FOLDER STRUCTURE
        // ═══════════════════════════════════════════════════════════
        h1('11. Project Folder Structure'),
        body('The following tree shows all custom source files (excluding node_modules, .next, and shadcn/ui boilerplate components). The structure follows Next.js 16 App Router conventions with separate directories for components, hooks, i18n, lib, services, and stores.'),
        ...[  
          'bandhan/',
          '  Caddyfile',
          '  next.config.ts',
          '  package.json',
          '  tsconfig.json',
          '  eslint.config.mjs',
          '  postcss.config.mjs',
          '  prisma/',
          '    schema.prisma          (19 models, 477 lines)',
          '  public/',
          '    logo-en.jpg, logo-hi.jpg, logo.svg, hindi-official.jpg',
          '    hero-matrimony.png, hero-business.png, hero-jobs.png, hero-directory.png',
          '    featured-bride.png, featured-groom.png',
          '    success-story-1.png, success-story-2.png',
          '    robots.txt',
          '  src/',
          '    app/',
          '      layout.tsx            (Root layout, fonts, metadata)',
          '      page.tsx              (Homepage assembly)',
          '      globals.css           (Design system, 270 lines)',
          '    components/',
          '      layout/',
          '        TopInfoBar.tsx, Header.tsx, Footer.tsx',
          '      home/',
          '        PremiumHeroCarousel.tsx, PremiumServiceCards.tsx',
          '        FeaturedProfiles.tsx, SuccessStories.tsx',
          '        PremiumStats.tsx, PremiumAdBanner.tsx',
          '        HeroSection.tsx (unused), StatsSection.tsx (unused)',
          '      shared/',
          '        BandhanLogo.tsx, LanguageSwitcher.tsx',
          '        AdCarousel.tsx (unused), SectionDivider.tsx (unused)',
          '      ui/                   (48 shadcn/ui boilerplate files, untouched)',
          '    hooks/',
          '      use-mobile.ts, use-toast.ts',
          '    i18n/',
          '      translations.ts       (120+ keys, 389 lines)',
          '      index.ts              (useTranslations hook)',
          '    lib/',
          '      auth.ts               (Hashing, tokens, rate limit)',
          '      auth-middleware.ts     (Session, admin, RBAC middleware)',
          '      db.ts                 (Prisma singleton)',
          '      api-response.ts       (Standard response helpers)',
          '      otp.ts                (OTP send/verify with DB)',
          '      rbac.ts               (6 roles, 31 permissions)',
          '      audit.ts              (Audit + security event logging)',
          '      validation.ts         (Sanitizers, validators)',
          '      notification.ts       (Create, unread count, mark read)',
          '      seed.ts               (Roles, permissions, plans, config)',
          '      utils.ts              (cn() helper)',
          '    services/',
          '      ai.ts                 (6 AI stub functions)',
          '      cache.ts              (In-memory cache with TTL)',
          '      media.ts              (Media record CRUD, no upload)',
          '      monitoring.ts         (Health, metrics stub)',
          '      queue.ts              (Job queue framework, no handlers)',
          '      search.ts             (Profile search with LIKE)',
          '    stores/',
          '      language-store.ts     (Zustand persisted locale)',
          '  scripts/',
          '    seed.js                (JS seed, partial)',
          '    keepalive-prod.sh      (Production keepalive)',
          '    proxy-strip-headers.js  (Header-stripping proxy)',
        ].map(line => new Paragraph({ spacing: { after: 0, line: 260 },
          children: [new TextRun({ text: line, size: 18, font: { ascii: 'Courier New', eastAsia: 'SimHei' }, color: '333333' })] })),

        // ═══════════════════════════════════════════════════════════
        // SECTION 12: API STRUCTURE
        // ═══════════════════════════════════════════════════════════
        h1('12. API Route Structure'),
        body('The API follows a dual-path architecture: canonical implementations under /api/ and versioned access under /api/v1/. The v1 layer either re-exports the canonical handler or provides standalone implementations. All 44 routes are listed below.'),
        h2('12.1 Authentication Routes'),
        ...[  
          'POST   /api/auth/login              Login with email/phone + password',
          'POST   /api/auth/register           User registration with auto-approval',
          'POST   /api/auth/logout              Delete session, audit log',
          'GET    /api/auth/me                  Current user with role, profile, membership',
          'POST   /api/auth/otp/send           Send OTP (email or phone)',
          'POST   /api/auth/otp/verify          Verify OTP code',
          '',
          'POST   /api/v1/auth/login           Re-export of /api/auth/login',
          'POST   /api/v1/auth/register        Re-export of /api/auth/register',
          'POST   /api/v1/auth/logout           Re-export of /api/auth/logout',
          'GET    /api/v1/auth/me               Re-export of /api/auth/me',
          'POST   /api/v1/auth/otp/send        Re-export of /api/auth/otp/send',
          'POST   /api/v1/auth/otp/verify       Re-export of /api/auth/otp/verify',
        ].map(line => new Paragraph({ spacing: { after: 0, line: 260 },
          children: [new TextRun({ text: line || ' ', size: 18, font: { ascii: 'Courier New' }, color: line ? '333333' : 'FFFFFF' })] })),
        h2('12.2 User Routes'),
        ...[  
          'GET    /api/user/profile             Get current user profile',
          'PUT    /api/user/profile             Update profile (whitelist fields)',
          'GET    /api/user/notifications       List with pagination + unread filter',
          'PATCH  /api/user/notifications       Mark individual or all as read',
          '',
          'GET    /api/v1/user/profile          Re-export of /api/user/profile',
          'PATCH  /api/v1/user/notifications    Re-export of /api/user/notifications',
        ].map(line => new Paragraph({ spacing: { after: 0, line: 260 },
          children: [new TextRun({ text: line || ' ', size: 18, font: { ascii: 'Courier New' }, color: line ? '333333' : 'FFFFFF' })] })),
        h2('12.3 Admin Routes (Canonical)'),
        ...[  
          'GET    /api/admin/dashboard          10 parallel DB queries, stats',
          'GET    /api/admin/security           Security events with pagination',
          'GET    /api/admin/roles              List roles with permissions + user counts',
          'PUT    /api/admin/roles              Replace role permissions',
          'GET    /api/admin/approvals          List pending approvals',
          'GET    /api/admin/users              List users with filters',
          'PATCH  /api/admin/users              Approve/reject/block/unblock user',
        ].map(line => new Paragraph({ spacing: { after: 0, line: 260 },
          children: [new TextRun({ text: line, size: 18, font: { ascii: 'Courier New' }, color: '333333' })] })),
        h2('12.4 Admin Routes (v1 Standalone)'),
        ...[  
          'GET    /api/v1/admin/settings        List system configurations',
          'PUT    /api/v1/admin/settings        Upsert configs (SUPER_ADMIN only)',
          'GET    /api/v1/admin/ai-approval      List AI-eligible pending users',
          'POST   /api/v1/admin/ai-approval      Trigger AI approval check',
          'GET    /api/v1/admin/advertisements  List advertisements',
          'POST   /api/v1/admin/advertisements  Create advertisement',
          'PATCH  /api/v1/admin/advertisements  Update advertisement',
          'GET    /api/v1/admin/membership       List memberships + plans',
          'POST   /api/v1/admin/membership       Create membership, update tier',
          'GET    /api/v1/admin/analytics        Period-based analytics',
          'GET    /api/v1/admin/audit-logs       Filtered audit log listing',
          'GET    /api/v1/admin/dashboard        Re-export of /api/admin/dashboard',
          'GET    /api/v1/admin/security         Re-export of /api/admin/security',
          'PUT    /api/v1/admin/roles            Re-export of /api/admin/roles',
          'GET    /api/v1/admin/approvals        Re-export of /api/admin/approvals',
          'GET    /api/v1/admin/users            Re-export of /api/admin/users',
        ].map(line => new Paragraph({ spacing: { after: 0, line: 260 },
          children: [new TextRun({ text: line, size: 18, font: { ascii: 'Courier New' }, color: '333333' })] })),
        h2('12.5 AI Routes (All Stubs)'),
        ...[  
          'POST   /api/v1/ai/match             Profile matching (returns score: 0)',
          'POST   /api/v1/ai/astrology          Astrology matching (returns score: 0)',
          'GET    /api/v1/ai/recommendations   Recommendations (returns [])',
          'POST   /api/v1/ai/assistant          AI chat (returns "not configured")',
          'POST   /api/v1/ai/moderation         Image moderation (auto-approves)',
        ].map(line => new Paragraph({ spacing: { after: 0, line: 260 },
          children: [new TextRun({ text: line, size: 18, font: { ascii: 'Courier New' }, color: '333333' })] })),
        h2('12.6 Other Routes'),
        ...[  
          'GET    /api/v1/health                Health check with DB ping',
          'GET    /api/v1/search                Profile search with filters',
          'GET    /api/                          Placeholder: "Hello, world!"',
        ].map(line => new Paragraph({ spacing: { after: 0, line: 260 },
          children: [new TextRun({ text: line, size: 18, font: { ascii: 'Courier New' }, color: '333333' })] })),

        // ═══════════════════════════════════════════════════════════
        // SECTION 13: DATABASE SCHEMA
        // ═══════════════════════════════════════════════════════════
        h1('13. Database Schema Summary'),
        body('The Prisma schema defines 19 models with comprehensive field definitions, relations, and constraints. The database provider is currently SQLite, which should be migrated to PostgreSQL for production use. The following table summarizes every model with its field count, key fields, and relationships.'),
        makeTable(
          ['Model', 'Fields', 'Key Fields', 'Relations'],
          [
            ['Role', '7', 'name (unique), displayName, level, description', 'users, permissions'],
            ['Permission', '5', 'name (unique), module, description', 'roles'],
            ['RolePermission', '4', 'roleId, permissionId (unique pair)', 'role, permission'],
            ['User', '24+', 'email, phone, passwordHash, status, roleId, membershipTier, deletedAt', '14 relations'],
            ['Profile', '44', 'Basic, location, professional, matrimony, business, directory, privacy, social, AI fields', 'user (1:1)'],
            ['OtpVerification', '10', 'type, method, identifier, otpCode, attempts, maxAttempts, verified, expiresAt', 'user'],
            ['Approval', '8', 'action, reason, reviewedBy, status, aiProcessed', 'user, reviewer'],
            ['Membership', '10', 'tier, status, startedAt, expiresAt, paymentMethod, amount', 'user'],
            ['MembershipPlan', '12', 'name (unique), price, currency, durationDays, features, maxContacts', 'standalone'],
            ['Media', '13+', 'category, type, fileName, fileSize, mimeType, url, thumbnailUrl, aiModerated', 'user'],
            ['Notification', '9', 'type, title, message, data, channel, read', 'user'],
            ['ContactRequest', '6', 'message, status', 'sender, receiver'],
            ['AppointmentRequest', '10', 'title, message, proposedDate, proposedTime, status', 'sender, receiver'],
            ['AuditLog', '9', 'action, entity, entityId, details, ipAddress', 'user'],
            ['SecurityEvent', '9', 'eventType, description, severity, metadata', 'user'],
            ['LoginHistory', '7', 'ipAddress, userAgent, device, location, success', 'user'],
            ['UserSession', '7', 'token (unique), device, ipAddress, userAgent, expiresAt', 'user'],
            ['Advertisement', '14+', 'title, imageUrl, linkUrl, position, category, status, impressions, clicks', 'user'],
            ['SystemConfiguration', '7', 'key (unique), value, description, category, isPublic', 'standalone'],
          ],
          [18, 8, 42, 32],
        ),

        // ═══════════════════════════════════════════════════════════
        // SECTION 14: COMPLETION PERCENTAGES
        // ═══════════════════════════════════════════════════════════
        h1('14. Project Completion Percentages'),
        body('The following completion percentages are calculated based on the audit findings across all dimensions of the project. Each percentage reflects the ratio of implemented functionality to the total planned scope for that phase or category.'),
        h2('14.1 Phase 1: Premium UI Redesign'),
        makeTable(
          ['Category', 'Weight', 'Completion', 'Notes'],
          [
            ['UI Components', '25%', '100%', 'All 11 active components fully implemented with animations'],
            ['Responsive Design', '15%', '95%', '4 breakpoints, mobile drawer; desktop nav only at xl:'],
            ['Multilingual i18n', '15%', '100%', '120+ keys, 100% HI coverage, Zustand persisted'],
            ['Logo Switching', '5%', '100%', 'Locale-based EN/HI, object-contain, responsive'],
            ['Hero Carousel', '10%', '100%', '4 slides, auto-play, AnimatePresence, color themes'],
            ['Advertisements', '5%', '100%', '2 photo banners with gradient overlays'],
            ['Design System', '10%', '100%', '38 CSS vars, 8 animations, glass utilities'],
            ['Footer / Header', '10%', '100%', 'Complete with responsive breakpoints'],
            ['Homepage Assembly', '5%', '100%', '10-section flow, zero errors'],
          ],
          [25, 12, 15, 48],
        ),
        spacer(80),
        bodyNoIndent('Phase 1 Overall Completion: 95%'),
        body('The remaining 5% accounts for the hardcoded lang="en" in layout.tsx (never updates to "hi"), missing legal links in the footer, and the <html lang> attribute not being reactive. All visual and interactive elements are complete and functional.'),

        h2('14.2 Phase 2: Enterprise Backend'),
        makeTable(
          ['Category', 'Weight', 'Completion', 'Notes'],
          [
            ['Database Schema', '15%', '85%', '19 models, well-structured; missing indexes, SQLite limitation'],
            ['Authentication', '15%', '75%', 'Login/register/session/OTP complete; no password reset, no social auth'],
            ['RBAC', '10%', '40%', 'Schema and roles defined; runtime disconnected from database'],
            ['API Routes (Auth + User)', '10%', '80%', 'All core routes functional'],
            ['API Routes (Admin)', '10%', '85%', 'Dashboard, users, roles, settings, ads, membership, analytics'],
            ['API Routes (AI)', '5%', '5%', 'All 5 routes exist but are pure stubs returning zero/empty'],
            ['Security', '10%', '55%', 'Headers, rate limit, lockout; no CSRF, CORS wildcard, no middleware.ts'],
            ['Services (Cache/Queue)', '5%', '30%', 'In-memory only, unbounded, no Redis, no registered handlers'],
            ['Services (Search/Media)', '5%', '45%', 'Search works with LIKE; media has no actual upload handling'],
            ['Services (AI/Monitoring)', '5%', '10%', 'AI all stubs; monitoring never called from routes'],
            ['Configuration', '5%', '40%', 'Missing .env, .env.example, middleware.ts; lint disabled'],
            ['Infrastructure', '5%', '20%', 'No Redis, no S3, no email/SMS, no PostgreSQL, no tests'],
          ],
          [25, 12, 15, 48],
        ),
        spacer(80),
        bodyNoIndent('Phase 2 Overall Completion: 55%'),
        body('The backend has a solid foundation with functional authentication, comprehensive admin APIs, and a well-designed database schema. The critical gaps are: (1) RBAC runtime is fake - database changes have no effect, (2) all six AI service functions are stubs, (3) no actual file upload, (4) in-memory services cannot survive production use, and (5) critical security gaps exist in CORS configuration, input validation, and OTP handling.'),

        h2('14.3 Overall Project Completion'),
        spacer(40),
        makeTable(
          ['Phase', 'Completion', 'Weighted Contribution'],
          [
            ['Phase 1: Premium UI', '95%', '47.5%'],
            ['Phase 2: Enterprise Backend', '55%', '27.5%'],
            ['Overall Project', '72%', '75% of Phase 1 weight + 55% of Phase 2 weight'],
          ],
          [40, 25, 35],
        ),
        spacer(80),
        body('The Bandhan platform has achieved 72% overall completion. Phase 1 (UI) is nearly production-ready at 95%, requiring only minor fixes. Phase 2 (Backend) is at 55%, with the authentication and admin subsystems being the strongest components, while AI services and infrastructure integrations represent the largest gaps. The most impactful next steps would be: connecting RBAC runtime to the database, integrating Redis for all in-memory services, migrating from SQLite to PostgreSQL, implementing actual file upload handling, and beginning AI model integration for the core matching and recommendation features.'),
      ],
    },
  ],
});

// ── Generate ──
Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync('/home/z/my-project/download/Bandhan-Enterprise-Audit-Report.docx', buf);
  console.log('Audit report generated: /home/z/my-project/download/Bandhan-Enterprise-Audit-Report.docx');
  console.log('Size:', (buf.length / 1024).toFixed(1), 'KB');
});
