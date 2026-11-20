import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { DRIVER_PROFILES_GUIDE, REFERENCE_SYSTEMS } from '../data/referenceData';
import { DriverBitSchematic } from './DriverBitSchematic';

export function ImplantReferenceView() {
  const [query, setQuery] = useState('');
  const [selectedManufacturer, setSelectedManufacturer] = useState<string>('All');

  const manufacturers = useMemo(() => {
    const unique = Array.from(new Set(REFERENCE_SYSTEMS.map((r) => r.manufacturer)));
    return ['All', ...unique];
  }, []);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return REFERENCE_SYSTEMS.filter((row) => {
      if (selectedManufacturer !== 'All' && row.manufacturer !== selectedManufacturer) {
        return false;
      }
      if (!q) return true;
      return (
        row.manufacturer.toLowerCase().includes(q) ||
        row.system.toLowerCase().includes(q) ||
        row.collarType.toLowerCase().includes(q) ||
        row.threadGeometry.toLowerCase().includes(q) ||
        row.connection.toLowerCase().includes(q) ||
        row.driverBit.toLowerCase().includes(q)
      );
    });
  }, [query, selectedManufacturer]);

  return (
    <section aria-label="Implant geometric reference library" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            Implant Morphology Reference
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Cross-check radiographic landmarks, internal connections, restorative driver bits, and standard torque protocols.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter system, thread, driver…"
            aria-label="Filter implant reference library"
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600"
          />
        </div>
      </div>

      {/* Manufacturer filter segmented bar */}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by manufacturer">
        {manufacturers.map((mfr) => (
          <button
            key={mfr}
            type="button"
            onClick={() => setSelectedManufacturer(mfr)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              selectedManufacturer === mfr
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            {mfr}
          </button>
        ))}
      </div>

      {/* Structured Reference Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4 whitespace-nowrap">System</th>
                <th className="py-3 px-4 whitespace-nowrap">Collar Design</th>
                <th className="py-3 px-4 whitespace-nowrap">Body & Threads</th>
                <th className="py-3 px-4 whitespace-nowrap">Apical Form</th>
                <th className="py-3 px-4 whitespace-nowrap">Screwdriver Bit</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Torque</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4 align-top">
                    <p className="font-semibold text-slate-900">{row.system}</p>
                    <p className="text-slate-500 mt-0.5">
                      {row.manufacturer} · {row.connection}
                    </p>
                  </td>
                  <td className="py-3.5 px-4 align-top text-slate-700">{row.collarType}</td>
                  <td className="py-3.5 px-4 align-top text-slate-700">
                    <p>{row.bodyGeometry}</p>
                    <p className="text-slate-500 mt-0.5">{row.threadGeometry}</p>
                  </td>
                  <td className="py-3.5 px-4 align-top text-slate-700">{row.apicalForm}</td>
                  <td className="py-3.5 px-4 align-top font-medium text-slate-900">
                    <p>{row.driverBit}</p>
                    {row.scanBody && (
                      <p className="text-[11px] font-normal text-slate-500 mt-0.5">
                        {row.scanBody}
                      </p>
                    )}
                  </td>
                  <td className="py-3.5 px-4 align-top text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                    {row.torqueLabel ? (
                      <span className="text-[11px]">{row.torqueLabel}</span>
                    ) : (
                      <>
                        {row.torqueNcm} <span className="text-slate-400 font-normal">Ncm</span>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm text-slate-500">
                    No implant systems match &ldquo;{query}&rdquo;.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export function TorqueDriversView() {
  return (
    <section aria-label="Prosthetic screwdriver bits and torque guide" className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
          Restorative Screwdriver Bits & Torque Matrix
        </h1>
        <p className="text-sm text-slate-600 mt-1 max-w-2xl">
          Geometric identification of common restorative screw drive profiles and definitive abutment torque ranges for chairside and laboratory verification.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200">
        {DRIVER_PROFILES_GUIDE.map((item) => (
          <div
            key={item.name}
            className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center"
          >
            <div className="md:col-span-5 flex items-center gap-4">
              <DriverBitSchematic profile={item.profile} size={56} className="shrink-0" />
              <div>
                <h2 className="text-base font-semibold text-slate-900">{item.name}</h2>
                <p className="text-xs font-mono text-slate-500 mt-0.5">{item.nominalSize}</p>
              </div>
            </div>

            <div className="md:col-span-5 space-y-1">
              <p className="text-xs font-medium text-slate-900">{item.systemsNote}</p>
              <p className="text-xs text-slate-600 leading-relaxed">{item.clinicalTip}</p>
            </div>

            <div className="md:col-span-2 md:text-right">
              <span className="block text-[11px] text-slate-500">Standard Torque</span>
              <span className="font-mono tabular-nums text-lg font-semibold text-slate-900">
                {item.typicalTorqueRange}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
