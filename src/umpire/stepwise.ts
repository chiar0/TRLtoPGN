// Minimal StepwiseLocalUmpire-compatible shim for chess-only.
// Purpose: parse SAN tokens stepwise and expose capture/check flags.
// Note: This avoids external dependencies; check is inferred from '+'/'#' in SAN.

export interface MoveInfo {
  san: string;
  from?: string;
  to?: string;
  promotion?: string | null;
  capture: boolean;
  check: boolean;
  mate: boolean;
}

export class StepwiseLocalUmpire {
  constructor() {}
  stepwiseInit(_fen?: string | null, _opts?: unknown) {
    // No-op: using SAN-only inference
  }
  getMoveFromPGN(token: string, _whiteTurn: boolean): MoveInfo {
    // Very lightweight SAN interpretation; geometry resolved elsewhere if needed
    const san = token.trim();
    const info: MoveInfo = {
      san,
      capture: /x/.test(san),
      check: /\+$/.test(san),
      mate: /#$/.test(san),
      promotion: san.includes('=') ? san.split('=')[1].slice(0,1) : null,
    };
    return info;
  }
}
