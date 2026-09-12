use anchor_lang::prelude::*;

pub mod errors;
pub mod scaled_ui;

declare_id!("EHm3a6HCDyJAcRbzd5oWGFBxXp5hBkKrWcF9cPE7rA2F");

#[program]
pub mod stokss {
    use super::*;

    /// Placeholder so the crate is a valid Anchor program while phase 2 instructions land.
    pub fn ping(_ctx: Context<Ping>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Ping<'info> {
    pub signer: Signer<'info>,
}
