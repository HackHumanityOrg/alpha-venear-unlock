export interface TestAccount {
  accountId: string;
  lockupAccountId: string;
}

export const TEST_ACCOUNTS: TestAccount[] = [
  {
    accountId: "kvshnir.tg",
    lockupAccountId: "d91602c6d32596852e674e77dc9bbbb7ee24b747.v.voteagora.near",
  },
];

export function isTestAccount(accountId: string): boolean {
  return TEST_ACCOUNTS.some((account) => account.accountId === accountId);
}

export function getTestAccountLockup(accountId: string): string | null {
  const account = TEST_ACCOUNTS.find((acc) => acc.accountId === accountId);
  return account ? account.lockupAccountId : null;
}
