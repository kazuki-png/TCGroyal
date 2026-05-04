import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-200 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span className="text-xl font-bold tracking-tight">TCG Royal</span>
          <div className="flex gap-4">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900"
            >
              ログイン
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
            >
              新規登録
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-5xl px-6 py-24 text-center">
          <h1 className="text-5xl font-extrabold tracking-tight text-zinc-900">
            トレカを高価買取
          </h1>
          <p className="mt-6 text-xl text-zinc-500">
            ポケモンカード・ワンピースカードのPSA鑑定品を
            <br />
            郵送で簡単に売却できます
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Link
              href="/signup"
              className="rounded-xl bg-zinc-900 px-8 py-4 text-lg font-semibold text-white hover:bg-zinc-700"
            >
              無料で始める
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-zinc-300 px-8 py-4 text-lg font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              ログイン
            </Link>
          </div>
        </section>

        <section className="bg-zinc-50 py-20">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="mb-12 text-center text-3xl font-bold text-zinc-900">
              ご利用の流れ
            </h2>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
              {[
                {
                  step: '1',
                  title: '会員登録',
                  desc: '無料で会員登録をします',
                },
                {
                  step: '2',
                  title: 'カード選択',
                  desc: '売却したいカードと枚数を選択',
                },
                {
                  step: '3',
                  title: '郵送',
                  desc: '専用封筒でカードを郵送',
                },
                {
                  step: '4',
                  title: '振込',
                  desc: '査定後、指定口座へ振込',
                },
              ].map(({ step, title, desc }) => (
                <div key={step} className="text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-xl font-bold text-white">
                    {step}
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">{title}</h3>
                  <p className="text-zinc-500">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="mb-12 text-center text-3xl font-bold text-zinc-900">
              買取対象カード
            </h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {[
                {
                  title: 'ポケモンカード',
                  grades: ['PSA10', 'PSA9', 'PSA8'],
                  emoji: '🎮',
                },
                {
                  title: 'ワンピースカード',
                  grades: ['PSA10', 'PSA9', 'PSA8'],
                  emoji: '⚓',
                },
              ].map(({ title, grades, emoji }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-zinc-200 p-8"
                >
                  <div className="mb-4 text-4xl">{emoji}</div>
                  <h3 className="mb-3 text-xl font-bold">{title}</h3>
                  <div className="flex gap-2">
                    {grades.map((g) => (
                      <span
                        key={g}
                        className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 px-6 py-8 text-center text-sm text-zinc-400">
        © 2025 TCG Royal. All rights reserved.
      </footer>
    </div>
  )
}
