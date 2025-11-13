# veNEAR Alpha Unlock Interface

A web interface for unlocking NEAR tokens from the veNEAR Alpha contracts (`v.voteagora.near`). This application implements the complete 7-step unlock process described in the [official guide](https://github.com/voteagora/agora-near/wiki/How-to:-Unlock-NEAR-in-veNEAR-Alpha-Contracts).

## What This App Does

If you locked NEAR tokens in the House of Stake (HoS) Alpha veNEAR contracts, this app helps you unlock them through a guided interface:

1. **View locked balances** - See your locked, pending, and liquid veNEAR amounts
2. **Monitor staking status** - Check if tokens are staked and manage staking pool operations
3. **Initiate unlock** - Start the 91.25-day (3-month) unlock period
4. **Track progress** - Visual progress bar and countdown timer
5. **Complete unlock** - Finalize after the waiting period
6. **Transfer tokens** - Move NEAR to your main account
7. **Browse all accounts** - Public list of all locked veNEAR accounts

### The Unlock Process

**Step 1: Connect & View**

- Connect your NEAR wallet
- App finds your lockup contract via `v.voteagora.near`
- Displays your locked, pending, and liquid balances

**Step 2: Begin Unlock**

- Click "Begin Unlock" to start the process
- Initiates a 91.25-day (3-month) waiting period
- Requires wallet signature to confirm

**Step 3: Wait & Monitor**

- Progress bar shows unlock completion percentage
- Countdown timer displays time remaining
- Balances auto-refresh every 30 seconds

**Step 4: Handle Staking (if applicable)**

If your tokens are staked with validators, you must:

1. **Unstake** - Remove tokens from the staking pool
2. **Wait** - 2-4 epochs (12-24 hours) for unstaking to complete
3. **Withdraw** - Move tokens from staking pool back to lockup contract

The app automatically:

- Detects if you have staked tokens
- Shows your staking status (Staked/Unstaking/Unstaked)
- Provides buttons to unstake and withdraw
- Prevents unlock completion until staking operations are done

**Step 5: Complete Unlock**

- After 91.25 days, the "Complete Unlock" button becomes active
- Click to finalize the unlock
- Tokens move from "Pending" to "Liquid" balance

**Step 6: Transfer to Your Account**

- Click "Transfer to My Account"
- Moves NEAR from the lockup contract to your wallet
- Tokens are now fully under your control

_Note: The app uses 125 TGas for most operations_

### Additional Features

**Public Accounts List**

- View all accounts with locked veNEAR
- See unlock progress and status for each account
- Track total locked amounts across the protocol
- Links to NEARBlocks for transaction verification

## Important Notes

- **Unlock Period**: Once you begin unlock, you must wait 91.25 days before completing it
- **Staking**: If your tokens are staked, you must unstake and withdraw before completing unlock
- **Wallet Signature**: All operations require your wallet signature

## References

Based on the official documentation:

- [How to Unlock NEAR in veNEAR Alpha Contracts](https://github.com/voteagora/agora-near/wiki/How-to:-Unlock-NEAR-in-veNEAR-Alpha-Contracts) - Official unlock guide
- [House of Stake Contracts](https://github.com/houseofstake/house-of-stake-contracts) - Contract source code
- [v.voteagora.near](https://nearblocks.io/address/v.voteagora.near) - veNEAR contract on NEARBlocks

---

**Built by [HackHumanity](https://hackhumanity.com)** | [X/Twitter](https://x.com/HackHumanityCo) | [GitHub](https://github.com/HackHumanityOrg)
