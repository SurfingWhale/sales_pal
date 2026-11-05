# Interaction model

Rules that hold across every feature. A feature spec may add rules, not contradict these. Changing one is a product decision: record it here with the date.

## Actions

- **One dominant primary action per context.** Secondary actions don't compete visually. In the lead page that's Tulis pesan. In a list card it's the one next move (`nextMove`).
- **Status shows state; it is not a button.** The Posisi dot, badges and counts don't act. If something must act, it looks like a control.
- **Navigation looks different from actions:** tabs and back versus buttons.
- **Progressive disclosure:** show the next move, keep the rest one tap away (a log row shows one Ubah; Lainnya opens the rest).
- **Destructive actions ask first** in an in-app sheet (`ConfirmSheet`), never a browser `confirm`, or offer Batal right after.

## Layers: tabs, in place, on top

| Kind | Used for | Close |
|---|---|---|
| Tab switch | Prospek · Leads · Performa; Leads · Penawaran · Invoice | Pick another tab. Hidden tabs keep their state |
| Open in place | folds, a log row's Ubah, Lainnya | The same control. One open at a time |
| On top (overlay) | lead page, sheets, confirm | ×, scrim, Escape, phone Back |

- Every overlay goes through `components/ModalA11y.tsx`: focus moves in and back, Tab stays inside, Escape means a tap on the scrim, and each overlay has its own history entry, so phone Back closes the top one.
- **No modal on a modal for a task.** A task that replaces what opened it uses `Sheet full` (Pesan, Script pesan). Short asks stay small sheets.
- A wide full sheet is one centred column (max 1120px), so the title, × and content stay together.
- A long full sheet keeps its title and × in view while it scrolls.
- Back, Batal and × never throw away typed text without asking (`useDiscard`).
- Opening a sheet, dialog or detail keeps the context behind it; closing returns there, scrolled where it was.

## WhatsApp and sending

- Opening WhatsApp (`wa.me`) is not sending. **A message counts as sent only after the seller confirms it** (Udah). Belum leaves nothing recorded.
- Never claim delivery or read status: there's no verified integration.
- A reply is recorded by the seller (Mereka bales) and needs its conversation context plus a next action.
- In a run of messages, a confirmed send goes straight on to the next person (Udah, lanjut ke …): two taps per lead.

## Separate concepts

Keep these apart in data, UI and copy:
- **Posisi** (funnel position, read from what happened, `lib/leadStand.ts`)
- **Status** (the seller's judgement: Cold, Warm, Hot)
- **Activity history** (`lib/activity.ts`, Riwayat)
- **Conversation state** (who's waiting on whom, `ourTurn`)
- **Next action** (`nextMove`, scheduled follow-up)

A script match score is not a closing probability.

## Feedback

Every action gets a visible response near where it happened: a `role=status` line, a note with Batal, or the list changing. Saving or sending shows progress, and failure says what to do ("Cek koneksi, lalu coba lagi").

## Data honesty

Placeholders fill only from their own source: `{nama}` and `{usaha}` are the prospect's, `{bisnis}` is the seller's brand. Empty means the optional `[…]` part disappears, never a guess. Nothing invents a need, budget or intent.
