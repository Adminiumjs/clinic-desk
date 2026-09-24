/**
 * The one sheet or dialog open over the desk, by kind (`state/ui.ts`).
 *
 * Each sheet is its own module and closes itself through `onClose`; this is
 * the only place that knows them all.
 */
import { closeSheet, useUi } from "../state/ui.ts";

import BookVisit from "../sheets/BookVisit.tsx";
import MoveConfirm from "../sheets/MoveConfirm.tsx";
import SendOff from "../sheets/SendOff.tsx";
import RecordPayment from "../sheets/RecordPayment.tsx";
import Receipt from "../sheets/Receipt.tsx";
import WriteOff from "../sheets/WriteOff.tsx";
import NotNeeded from "../sheets/NotNeeded.tsx";
import AddClosure from "../sheets/AddClosure.tsx";
import EditHours from "../sheets/EditHours.tsx";
import CloseDesk from "../sheets/CloseDesk.tsx";
import Registration from "../sheets/Registration.tsx";
import WaitlistAsk from "../sheets/WaitlistAsk.tsx";
import { CancelDialog } from "./Overlays.tsx";

export default function SheetHost() {
  const sheet = useUi((s) => s.sheet);
  if (sheet === null) return null;
  const onClose = closeSheet;
  switch (sheet.kind) {
    case "book":
      return <BookVisit sheet={sheet} onClose={onClose} />;
    case "move":
      return <MoveConfirm sheet={sheet} onClose={onClose} />;
    case "cancel":
      return <CancelDialog sheet={sheet} onClose={onClose} />;
    case "sendOff":
      return <SendOff sheet={sheet} onClose={onClose} />;
    case "payment":
      return <RecordPayment sheet={sheet} onClose={onClose} />;
    case "receipt":
      return <Receipt sheet={sheet} onClose={onClose} />;
    case "writeOff":
      return <WriteOff sheet={sheet} onClose={onClose} />;
    case "notNeeded":
      return <NotNeeded sheet={sheet} onClose={onClose} />;
    case "closure":
      return <AddClosure sheet={sheet} onClose={onClose} />;
    case "hours":
      return <EditHours sheet={sheet} onClose={onClose} />;
    case "closeDesk":
      return <CloseDesk sheet={sheet} onClose={onClose} />;
    case "registration":
      return <Registration sheet={sheet} onClose={onClose} />;
    case "waitAsk":
      return <WaitlistAsk sheet={sheet} onClose={onClose} />;
  }
}
