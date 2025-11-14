"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { setupWalletSelector } from "@near-wallet-selector/core";
import type { WalletSelector, AccountState } from "@near-wallet-selector/core";
import { setupModal } from "@near-wallet-selector/modal-ui";
import type { WalletSelectorModal } from "@near-wallet-selector/modal-ui";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";
import { setupHereWallet } from "@near-wallet-selector/here-wallet";
import { setupLedger } from "@near-wallet-selector/ledger";

import "@near-wallet-selector/modal-ui/styles.css";
import type { TestAccount } from "@/lib/testAccounts";

const VENEAR_CONTRACT_ID = "v.voteagora.near";

interface WalletContextType {
  selector: WalletSelector | null;
  modal: WalletSelectorModal | null;
  accounts: Array<AccountState>;
  accountId: string | null;
  signIn: () => void;
  signOut: () => void;
  isTestMode: boolean;
  testAccount: TestAccount | null;
  setTestAccount: (account: TestAccount | null) => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [selector, setSelector] = useState<WalletSelector | null>(null);
  const [modal, setModal] = useState<WalletSelectorModal | null>(null);
  const [accounts, setAccounts] = useState<Array<AccountState>>([]);
  const [testAccount, setTestAccount] = useState<TestAccount | null>(null);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    const initWallet = async () => {
      try {
        const walletSelector = await setupWalletSelector({
          network: "mainnet",
          modules: [setupMyNearWallet(), setupMeteorWallet(), setupHereWallet(), setupLedger()],
        });

        const walletModal = setupModal(walletSelector, {
          description: "Connect your wallet to manage veNEAR tokens.",
        });

        setSelector(walletSelector);
        setModal(walletModal);

        const state = walletSelector.store.getState();
        setAccounts(state.accounts);

        subscription = walletSelector.store.observable.subscribe((state) => {
          setAccounts(state.accounts);
        });
      } catch (err) {
        console.error("Failed to initialize wallet:", err);
      }
    };

    initWallet();

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const signIn = useCallback(() => {
    modal?.show();
  }, [modal]);

  const signOut = useCallback(async () => {
    if (!selector) return;
    const wallet = await selector.wallet();
    await wallet.signOut();
  }, [selector]);

  const activeAccount = accounts.find((account) => account.active);
  const walletAccountId = activeAccount?.accountId ?? null;

  // Use test account if set, otherwise use wallet account
  const accountId = testAccount ? testAccount.accountId : walletAccountId;
  const isTestMode = testAccount !== null;

  return (
    <WalletContext.Provider
      value={{
        selector,
        modal,
        accounts,
        accountId,
        signIn,
        signOut,
        isTestMode,
        testAccount,
        setTestAccount,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return context;
}

export { VENEAR_CONTRACT_ID };
