import React from 'react'

const PLANS = [
  { id: 'plan-a', name: 'Plan A', price: 59, currency: 'ILS', sku: 'MAKAT-A' },
  { id: 'plan-b', name: 'Plan B', price: 29, currency: 'ILS', sku: 'MAKAT-B' },
  { id: 'plan-fg', name: 'Plan F/G', price: null, currency: 'ILS', sku: 'MAKAT-FG' },
]

export default function PackageSelection({ selectedPlanId, onSelect }) {
  return (
    <section className="mb-8 text-right">
      <h2 className="text-lg font-semibold text-medical-blue-dark mb-4">בחר את החבילה</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const isSelected = selectedPlanId === plan.id
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => onSelect(plan.id)}
              className={
                'text-right p-4 rounded-xl border-2 transition-all ' +
                (isSelected
                  ? 'border-medical-blue bg-medical-blue/5 shadow-md'
                  : 'border-slate-200 bg-white hover:border-medical-blue-dark/50 hover:bg-slate-50')
              }
            >
              <div className="font-semibold text-medical-blue-dark">{plan.name}</div>
              <div className="mt-1 text-medical-grey-dark text-sm">
                {plan.price != null ? plan.price + ' ' + plan.currency : plan.name}
              </div>
              <div className="mt-2 text-xs text-medical-grey">מק״ט: {plan.sku}</div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export { PLANS }
