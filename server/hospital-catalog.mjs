import { readFile } from 'node:fs/promises';

const catalog = JSON.parse(await readFile(new URL('./data/philippines-hospitals.json', import.meta.url), 'utf8'));
export const hospitalCatalogInfo = Object.freeze({ version: catalog.version, source: catalog.source, sourceUrl: catalog.sourceUrl,
  license: catalog.license, licenseUrl: catalog.licenseUrl, snapshotDate: catalog.snapshotDate, count: catalog.hospitals.length });

/** Transactional, once per snapshot. Existing operator records and deletions are preserved. */
export async function seedHospitalCatalog(db) {
  return db.transaction(async tx => {
    const key = 'hospital_catalog_' + catalog.version;
    const claimed = await tx.query("insert into eligtas.settings(key,value) values ($1,$2::jsonb) on conflict(key) do nothing returning key", [key, JSON.stringify(hospitalCatalogInfo)]);
    if (!claimed.rows.length) return 0;
    let inserted = 0;
    for (let i = 0; i < catalog.hospitals.length; i += 200) {
      const result = await tx.query(`insert into eligtas.response_facilities(id,kind,name,location,source_ref,source_data)
        select h.id,'hospital',h.name,h.location,h.source_ref,h.source_data from jsonb_to_recordset($1::jsonb)
        as h(id uuid,name text,location jsonb,source_ref text,source_data jsonb)
        where not exists (select 1 from eligtas.response_facility_exclusions e where e.id=h.id)
        on conflict(id) do nothing returning id`, [JSON.stringify(catalog.hospitals.slice(i, i + 200))]);
      inserted += result.rows.length;
    }
    return inserted;
  });
}

export async function listResponseFacilities(db, query = {}) {
  const q = typeof query.q === 'string' ? query.q.trim().slice(0, 100) : '';
  const kind = ['base', 'hospital'].includes(query.kind) ? query.kind : '';
  const offset = Math.min(100000, Math.max(0, parseInt(query.offset, 10) || 0)), limit = 30;
  const terms = q.split(/\s+/).filter(Boolean).slice(0, 8).map(term => '%' + term.replace(/[\\%_]/g, '\\$&') + '%');
  const args = [kind, ...terms];
  const where = "($1='' or kind=$1)" + terms.map((_, i) => ` and (name || ' ' || coalesce(source_data->>'address','')) ilike $${i + 2}`).join('');
  const total = Number((await db.query(`select count(*) as total from eligtas.response_facilities where ${where}`, args)).rows[0].total);
  const rows = (await db.query(`select id,kind,name,location,source_ref,source_data from eligtas.response_facilities where ${where} order by name,id limit ${limit} offset $${args.length + 1}`, [...args, offset])).rows;
  return { facilities: rows, total, offset, limit, catalog: hospitalCatalogInfo };
}
