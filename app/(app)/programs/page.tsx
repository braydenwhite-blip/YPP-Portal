import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-supabase';
import { getPrograms } from '@/lib/program-actions';
import Link from 'next/link';
import { PROGRAM_TYPE_CONFIG, PROGRAM_TYPE_ORDER, getProgramColor, formatProgramType } from '@/lib/program-constants';
import { ProgramType } from '@prisma/client';

export default async function ProgramsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const programs = await getPrograms();
  const grouped = PROGRAM_TYPE_ORDER.reduce((acc: any, type) => { acc[type] = programs.filter((p: any) => p.type === type); return acc; }, {} as Record<ProgramType, (typeof programs)[number][]>);
  const summerWorkshops = grouped.SUMMER_WORKSHOP ?? [];
  const hasAny = programs.length > 0;
  return (
    <main className="main-content programs-page">
      <div className="page-header">
        <div>
          <h1>Special Programs</h1>
          <p className="subtitle">Explore our special programming offerings beyond regular courses</p>
        </div>
        <Link href="/programs/my" className="btn btn-secondary">My Programs</Link>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-value">{programs.length}</span>
          <span className="stat-label">Total Programs</span>
        </div>
        {PROGRAM_TYPE_ORDER.map((type) => {
          const count = programs.filter((p: any) => p.type === type).length;
          const cfg = PROGRAM_TYPE_CONFIG[type];
          if (count === 0 && type !== 'SUMMER_WORKSHOP') return null;
          return (
            <div key={type} className="stat-card" style={count > 0 ? { borderLeft: `4px solid ${cfg.color}` } : undefined}>
              <span className="stat-value">{count}</span>
              <span className="stat-label">{cfg.label}</span>
            </div>
          );
        })}
      </div>

      {summerWorkshops.length > 0 && <FeaturedBanner programs={summerWorkshops} />}

      {hasAny ? PROGRAM_TYPE_ORDER.map((type) => {
        if (type === 'SUMMER_WORKSHOP') return null;
        const list = grouped[type] ?? [];
        if (list.length === 0) return null;
        const config = PROGRAM_TYPE_CONFIG[type];
        return <ProgramSection key={type} title={config.label} description={config.description} programs={list} color={config.color} />;
      }) : null}

      {!hasAny && (
        <div className="card empty">
          <p>No special programs available at this time. Check back soon!</p>
        </div>
      )}

      <style>{
      `
        .programs-page .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
        .programs-page .subtitle { color: var(--muted); margin: 0.5rem 0 0; }
        .programs-page .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
        .programs-page .stat-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 0.5rem; padding: 1rem; text-align: center; transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .programs-page .stat-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        .programs-page .stat-value { display: block; font-size: 2rem; font-weight: 700; color: var(--primary); }
        .programs-page .stat-label { color: var(--muted); font-size: 0.875rem; }
        .programs-page .empty { text-align: center; padding: 3rem; color: var(--muted); }
        .programs-page .featured-banner { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; align-items: center; padding: 2rem; border-radius: 0.75rem; margin-bottom: 2.5rem; background: linear-gradient(135deg, #2a0847 0%, #5a1da8 50%, #8b3fe8 100%); color: #fff; text-decoration: none; }
        @media (max-width: 768px) { .programs-page .featured-banner { grid-template-columns: 1fr; } }
        .programs-page .featured-label { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; background: rgba(255,255,255,0.15); padding: 0.35rem 0.75rem; border-radius: 999px; margin-bottom: 0.75rem; color: #fff; }
        .programs-page .featured-title { font-size: 1.5rem; font-weight: 700; margin: 0 0 0.5rem; line-height: 1.2; }
        .programs-page .featured-desc { margin: 0; opacity: 0.85; font-size: 0.95rem; line-height: 1.5; }
        .programs-page .featured-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
        .programs-page .featured-card { background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.18); border-radius: 0.6rem; padding: 1rem; color: #fff; text-decoration: none; transition: transform 0.15s ease, background 0.15s ease; }
        .programs-page .featured-card:hover { transform: translateY(-2px); background: rgba(255,255,255,0.2); color: #fff; }
        .programs-page .featured-card h4 { margin: 0 0 0.25rem; font-size: 0.95rem; }
        .programs-page .featured-card p { margin: 0; font-size: 0.8rem; opacity: 0.85; }
        .programs-page .featured-card .fc-tag { display: inline-block; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; background: #ea580c; padding: 0.2rem 0.5rem; border-radius: 999px; margin-bottom: 0.5rem; color: #fff; }
      `}</style>

      <style>{
      `
        .programs-page .program-section { margin-bottom: 3rem; }
        .programs-page .section-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
        .programs-page .section-icon { width: 8px; height: 48px; border-radius: 4px; }
        .programs-page .section-header h2 { margin: 0; }
        .programs-page .section-desc { margin: 0.25rem 0 0; color: var(--muted); font-size: 0.875rem; }
        .programs-page .programs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; }
        .programs-page .program-card { display: block; background: var(--card-bg); border: 1px solid var(--border); border-radius: 0.5rem; padding: 1.5rem; text-decoration: none; color: inherit; transition: all 0.2s; position: relative; overflow: hidden; }
        .programs-page .program-card::before { content: ''; position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: var(--card-accent, var(--primary)); transition: width 0.2s ease; }
        .programs-page .program-card:hover { border-color: var(--primary); transform: translateY(-3px); box-shadow: 0 12px 24px rgba(0, 0, 0, 0.12); }
        .programs-page .program-card:hover::before { width: 6px; }
        .programs-page .program-header { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; align-items: center; }
        .programs-page .type-badge { font-size: 0.75rem; color: white; padding: 0.25rem 0.75rem; border-radius: 1rem; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 700; }
        .programs-page .virtual-badge { font-size: 0.75rem; background: #dcfce7; color: #166534; padding: 0.25rem 0.75rem; border-radius: 1rem; }
        .programs-page .program-card h3 { margin: 0 0 0.5rem; font-size: 1.1rem; }
        .programs-page .description { font-size: 0.875rem; color: var(--muted); margin: 0 0 1rem; line-height: 1.55; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
        .programs-page .program-meta { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
        .programs-page .interest, .programs-page .leader { font-size: 0.75rem; background: var(--background); padding: 0.25rem 0.5rem; border-radius: 0.25rem; }
        .programs-page .program-stats { display: flex; justify-content: space-between; font-size: 0.875rem; color: var(--muted); padding-top: 1rem; border-top: 1px solid var(--border); }
        .programs-page .next-session { margin-top: 0.75rem; font-size: 0.875rem; color: var(--primary); font-weight: 500; }
      `}</style>
    </main>
  );
}

function FeaturedBanner({ programs }: { programs: any[] }) {
  const cfg = PROGRAM_TYPE_CONFIG.SUMMER_WORKSHOP;
  const featured = programs.slice(0, 4);

  return (
    <section className="programs-page">
      <Link href={`/programs/${featured[0]?.id}`} className="featured-banner" aria-label={`See all ${cfg.label}`}>
        <div>
          <div className="featured-label">{cfg.icon} Featured — {cfg.label}</div>
          <h2 className="featured-title">Build. Teach. Lead this summer.</h2>
          <p className="featured-desc">
            {cfg.description}. Pick a workshop below and start your teaching journey
            inside a local camp or chapter community.
          </p>
        </div>
        <div className="featured-cards">
          {featured.map((program: any) => (
            <div
              key={program.id}
              className="featured-card"
              onClick={(e: any) => {
                if ((e.target as HTMLElement).closest('a[href], button, [role=button]')) e.stopPropagation();
              }}
            >
              <span className="fc-tag">{cfg.label}</span>
              <h4>{program.name}</h4>
              <p>
                <strong>{program._count?.participants ?? 0}</strong> enrolled &middot; {' '}
                <strong>{program._count?.sessions ?? program.sessions?.length ?? 0}</strong> sessions
              </p>
            </div>
          ))}
          {programs.length > 4 && (
            <div className="featured-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ textAlign: 'center', margin: 0 }}>
                +{programs.length - 4} more<br />
                <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>View all workshops</span>
              </p>
            </div>
          )}
        </div>
      </Link>
    </section>
  );
}

function ProgramSection({
  title,
  description,
  programs,
  color,
}: {
  title: string;
  description: string;
  programs: any[];
  color: string;
}) {
  return (
    <section className="program-section">
      <div className="section-header">
        <div className="section-icon" style={{ backgroundColor: color }} />
        <div>
          <h2>{title}</h2>
          <p className="section-desc">{description}</p>
        </div>
      </div>

      <div className="programs-grid">
        {programs.map((program: any) => {
          const programColor = getProgramColor(program.type);
          return (
            <Link
              key={program.id}
              href={`/programs/${program.id}`}
              className="program-card"
              style={{ '--card-accent': programColor } as React.CSSProperties}
            >
              <div className="program-header">
                <span className="type-badge" style={{ backgroundColor: programColor }}>
                  {formatProgramType(program.type)}
                </span>
                {program.isVirtual && <span className="virtual-badge">Virtual</span>}
              </div>
              <h3>{program.name}</h3>
              {program.description && <p className="description">{program.description}</p>}
              <div className="program-meta">
                <span className="interest">{program.interestArea}</span>
                {program.leader && <span className="leader">Led by {program.leader.name}</span>}
              </div>
              <div className="program-stats">
                <span>{program._count?.participants ?? 0} enrolled</span>
                <span>{program.sessions?.length ?? program._count?.sessions ?? 0} sessions</span>
              </div>
              {program.sessions?.length > 0 && (
                <div className="next-session">Next: {' '}{new Date(program.sessions[0].scheduledAt).toLocaleDateString()}</div>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
