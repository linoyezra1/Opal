import React from 'react'

export default function BeneficiaryFields({ count, beneficiaries, onChange, errors = {} }) {
  if (count === 0) return null
  const getError = (i, field) => errors[`beneficiary_${i}_${field}`]
  return (
    <section className="mb-8 text-right">
      <h2 className="text-lg font-semibold text-medical-blue-dark mb-4">מוטבים נוספים</h2>
      <div className="space-y-6">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
            <h3 className="text-sm font-medium text-medical-grey-dark">מוטב {i + 1}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-medical-grey-dark mb-1 text-right">שם פרטי *</label>
                <input
                  type="text"
                  value={beneficiaries[i]?.firstName ?? ''}
                  onChange={(e) => onChange(i, 'firstName', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-blue focus:border-medical-blue text-right"
                  placeholder="שם פרטי"
                />
                {getError(i, 'firstName') && <p className="text-red-600 text-sm mt-1 text-right">{getError(i, 'firstName')}</p>}
              </div>
              <div>
                <label className="block text-sm text-medical-grey-dark mb-1 text-right">שם משפחה *</label>
                <input
                  type="text"
                  value={beneficiaries[i]?.lastName ?? ''}
                  onChange={(e) => onChange(i, 'lastName', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-blue focus:border-medical-blue text-right"
                  placeholder="שם משפחה"
                />
                {getError(i, 'lastName') && <p className="text-red-600 text-sm mt-1 text-right">{getError(i, 'lastName')}</p>}
              </div>
              <div>
                <label className="block text-sm text-medical-grey-dark mb-1 text-right">תעודת זהות *</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={9}
                  value={beneficiaries[i]?.id ?? ''}
                  onChange={(e) => onChange(i, 'id', e.target.value.replace(/\D/g, '').slice(0, 9))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-blue focus:border-medical-blue text-right"
                  placeholder="9 ספרות"
                />
                {getError(i, 'id') && <p className="text-red-600 text-sm mt-1 text-right">{getError(i, 'id')}</p>}
              </div>
              <div>
                <label className="block text-sm text-medical-grey-dark mb-1 text-right">תאריך לידה *</label>
                <input
                  type="date"
                  value={beneficiaries[i]?.dateOfBirth ?? ''}
                  onChange={(e) => onChange(i, 'dateOfBirth', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-medical-blue focus:border-medical-blue text-right"
                />
                {getError(i, 'dateOfBirth') && <p className="text-red-600 text-sm mt-1 text-right">{getError(i, 'dateOfBirth')}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
