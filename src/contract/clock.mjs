// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Preloaded into the contract's Adminium (`node --import`): the server's clock
 * starts at `CONTRACT_NOW` (epoch ms) and runs on from there.
 *
 * The contract adds the sample at the moment the demo's practice is pinned to
 * — 09:20 on Tuesday 28 July 2026 in London — so the rows Adminium writes are
 * the rows the demo resolves, on every engine. Only JavaScript's clock moves;
 * the server reads its "now" from it.
 */
const target = Number(process.env.CONTRACT_NOW);
if (Number.isFinite(target)) {
  const RealDate = Date;
  const offset = target - RealDate.now();
  class ContractDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(RealDate.now() + offset);
      else super(...args);
    }
    static now() {
      return RealDate.now() + offset;
    }
  }
  globalThis.Date = ContractDate;
}
