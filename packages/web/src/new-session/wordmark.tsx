import "./wordmark.css"

function Wordmark(props: { class: string }) {
  return (
    <svg class={props.class} viewBox="0 0 720 129" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <text x="360" y="104" text-anchor="middle" font-size="136" font-weight="600" letter-spacing="-5">
        iKanban
      </text>
    </svg>
  )
}

export function NewSessionWordmark() {
  return (
    <div
      data-component="new-session-wordmark"
      aria-hidden="true"
      class="pointer-events-none mx-auto w-full max-w-[720px] text-v2-background-bg-inverse"
    >
      <div data-slot="wordmark-reveal" class="relative mx-auto w-4/5">
        <Wordmark class="block aspect-[720/129] w-full opacity-[0.16]" />
        <Wordmark class="wordmark-shimmer absolute inset-0 aspect-[720/129] w-full" />
      </div>
    </div>
  )
}
