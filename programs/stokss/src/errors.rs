use anchor_lang::prelude::*;

#[error_code]
pub enum StokssError {
    #[msg("Program is paused")]
    Paused,
    #[msg("Only the configured keeper may call this")]
    NotKeeper,
    #[msg("Plan is closed")]
    PlanClosed,
    #[msg("Mint is not a Token-2022 mint")]
    NotToken2022,
    #[msg("Mint has no ScaledUiAmount extension")]
    NoScaledUiExtension,
    #[msg("Mint account data is malformed")]
    MalformedMint,
    #[msg("Multiplier has not increased since the last harvest; nothing to do")]
    NoTick,
    #[msg("Computed delta is zero")]
    ZeroDelta,
    #[msg("Multiplier moved backwards, which indicates a reverse split, not a dividend")]
    MultiplierDecreased,
    #[msg("Multiplier jumped further than any observed dividend; this looks like a split")]
    TickTooLarge,
    #[msg("Settle amount exceeds what this plan is owed")]
    OverSettle,
    #[msg("Nothing pending to settle")]
    NothingPending,
    #[msg("Arithmetic overflow")]
    Overflow,
}
