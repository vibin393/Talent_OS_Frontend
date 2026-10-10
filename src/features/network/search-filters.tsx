import type { JobsFilters } from "@/lib/api/network";
import { EMPLOYMENT_LABELS, POSTED_WITHIN_OPTIONS, WORK_MODE_LABELS } from "./format";

/** SSR search + filter panel (Epic 75, B1). A plain GET form so search works without client JS (keyboard-operable). */
export function SearchFilters({ filters }: { filters: JobsFilters }) {
  return (
    <form className="jobs-filters" method="get" action="/jobs">
      <div className="jobs-search-row">
        <label className="jobs-field">
          <span className="jobs-visually-hidden">Search</span>
          <input
            type="search"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Job title, skill or company"
            maxLength={200}
          />
        </label>
        <label className="jobs-field">
          <span className="jobs-visually-hidden">Location</span>
          <input type="text" name="location" defaultValue={filters.location ?? ""} placeholder="City or 'Remote'" maxLength={100} />
        </label>
        <button type="submit" className="jobs-button">
          Search
        </button>
      </div>
      <fieldset className="jobs-filter-panel">
        <label className="jobs-field">
          Work mode
          <select name="work_mode" defaultValue={filters.work_mode ?? ""}>
            <option value="">Any</option>
            {Object.entries(WORK_MODE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="jobs-field">
          Job type
          <select name="employment_type" defaultValue={filters.employment_type ?? ""}>
            <option value="">Any</option>
            {Object.entries(EMPLOYMENT_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="jobs-field">
          Experience (years)
          <input type="number" name="experience" min={0} max={50} defaultValue={filters.experience ?? ""} />
        </label>
        <label className="jobs-field">
          Salary from
          <input type="number" name="pay_min" min={0} step={1000} defaultValue={filters.pay_min ?? ""} />
        </label>
        <label className="jobs-field">
          Category
          <input type="text" name="category" defaultValue={filters.category ?? ""} maxLength={60} />
        </label>
        <label className="jobs-field">
          Posted
          <select name="posted_within" defaultValue={filters.posted_within ?? ""}>
            {POSTED_WITHIN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="jobs-button-subtle">
          Apply filters
        </button>
      </fieldset>
    </form>
  );
}
