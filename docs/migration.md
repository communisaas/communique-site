# Account Migration & Recovery Guide

**For Communique Users with NEAR Passkey Accounts**

This guide explains how to maintain control of your account even if:
- You lose access to your device
- You want to migrate to another NEAR wallet
- Communique shuts down or becomes unavailable

## 🔑 Your Account Belongs to You

Your Communique account is a **real NEAR account** that you own. It's not locked to Communique—you can:

- Export your account data anytime
- Import into any NEAR wallet supporting passkeys
- Recover access through your guardians
- Use it with any NEAR-compatible application

**Account Format**: `random-{hash}.communique.testnet`
**Authentication**: WebAuthn/FIDO2 Passkey (Touch ID, Face ID, etc.)

---

## 📤 Export Your Account

### From Communique Dashboard

1. **Navigate to Settings** → Blockchain → Export Account
2. **Click "Export Account Data"**
3. **Download JSON file** containing:
   - Account ID
   - Public key
   - Recovery configuration
   - Migration instructions
4. **Store securely** - Keep backup in safe location

### What Gets Exported

```json
{
  "accountId": "random-a3f2d9c8.communique.testnet",
  "publicKey": "ed25519:...",
  "recoveryConfig": {
    "guardians": ["friend@example.com", "family@example.com", "backup@example.com"],
    "threshold": 2
  },
  "exportedAt": "2025-10-13T...",
  "instructions": "..."
}
```

---

## 🔄 Migrate to Another NEAR Wallet

Your account uses **NEAR passkey authentication**, which is supported by multiple wallets.

### Compatible Wallets

1. **NEAR Wallet** (wallet.near.org)
   - Official NEAR wallet
   - Full passkey support
   - Best for general use

2. **MyNearWallet** (mynearwallet.com)
   - Community-maintained
   - Passkey authentication
   - Good privacy features

3. **Any WebAuthn-compatible NEAR wallet**
   - Must support passkey authentication
   - Check wallet documentation for import process

### Migration Steps

#### Option 1: Direct Import (Recommended)

1. **Go to compatible wallet**
2. **Select "Import Account"** or "Add Existing Account"
3. **Choose "Passkey Authentication"** method
4. **Enter your account ID**: `random-{hash}.communique.testnet`
5. **Authenticate with same biometric** you set up in Communique
6. **Account imported** - Full access restored

#### Option 2: Manual Setup

If direct import isn't available:

1. **Note your account ID** from export
2. **Contact wallet support** with your account ID
3. **Follow wallet-specific import process**
4. **Authenticate with your passkey** when prompted

---

## 🆘 Account Recovery (Lost Device)

If you lose access to your device, use **social recovery** with your guardians.

### Prerequisites

- ✅ Social recovery configured (3 guardians selected)
- ✅ At least 2 guardians can respond
- ✅ Access to email used for guardian invitations

### Recovery Steps

#### 1. Initiate Recovery

From a **new device**:

1. **Go to Communique** → Login → "Lost Device?"
2. **Enter your account ID**: `random-{hash}.communique.testnet`
3. **Click "Request Account Recovery"**
4. **Recovery request sent** to all guardians

#### 2. Guardian Approval

Each guardian receives email:

```
Subject: Account Recovery Request

{Your Name} has requested account recovery for:
random-a3f2d9c8.communique.testnet

Click to approve: [Approve Recovery]
Request details: [View Details]

Only approve if you verified this request with {Your Name} directly.
```

**Important**: Guardians should **verify with you** before approving.

#### 3. Complete Recovery

Once **2 guardians approve**:

1. **Return to Communique** recovery page
2. **Click "Complete Recovery"**
3. **Create new passkey** on new device
4. **Access restored** - Same account, new passkey

### Recovery Timeline

- **Request expires**: 7 days
- **Approval delay**: 24 hours (security measure)
- **Guardian notification**: Immediate

---

## 🚨 Emergency Scenarios

### Scenario 1: Communique Shuts Down

**You still own your account.** Here's what to do:

1. **Export your account data** before shutdown (if possible)
2. **Contact one of these NEAR wallets**:
   - NEAR Wallet: wallet.near.org
   - MyNearWallet: mynearwallet.com
3. **Provide your account ID**: `random-{hash}.communique.testnet`
4. **Import using passkey authentication**
5. **Full access restored** in new wallet

**Why this works**: Your account exists on NEAR Protocol blockchain, independent of Communique.

### Scenario 2: Lost Device + No Guardian Response

If you can't get guardian approval:

1. **Contact NEAR Protocol support**
2. **Provide proof of ownership**:
   - Export JSON from another device (if you backed it up)
   - Any blockchain transactions from your account
   - Screenshots of account usage
3. **NEAR may assist** with account recovery
4. **Process takes longer** (weeks, not hours)

**Prevention**: Always configure guardians and export your data.

### Scenario 3: Forgotten Account ID

Your account ID is stored in:

1. **Communique profile** (if you can login)
2. **Export JSON file** (if you backed it up)
3. **Email confirmations** from Communique
4. **Guardian notification emails** (if recovery was configured)

Without any of these, recovery is **very difficult** but possible through:
- Blockchain explorer search by public key
- Contacting Communique support with email/identity proof

---

## 🔐 Security Best Practices

### Immediate Actions

1. **✅ Export your account data now**
   - Don't wait for an emergency
   - Store in multiple safe locations
   - Update export after any changes

2. **✅ Configure social recovery**
   - Choose 3 trusted guardians
   - Verify they can receive emails
   - Test recovery process once

3. **✅ Document your account**
   - Screenshot your account ID
   - Save export JSON securely
   - Note which biometric you used

### Ongoing Maintenance

- **Review guardians annually** - Are they still reachable?
- **Update export after major changes** - New passkey, new guardians
- **Test alternative wallets** - Verify you can import if needed

---

## 🧪 Test Your Migration (Without Risk)

You can test migration **without losing access**:

1. **Install a compatible NEAR wallet** (e.g., MyNearWallet)
2. **Import your account** using your account ID
3. **Authenticate with same passkey**
4. **Verify access** - You should see same balance/state
5. **Continue using Communique** - Nothing changes

**Both wallets access the same account simultaneously.** This is safe and recommended.

---

## 📋 Migration Checklist

Before migrating away from Communique:

- [ ] Export account data and download JSON
- [ ] Choose target wallet (NEAR Wallet, MyNearWallet, etc.)
- [ ] Verify target wallet supports passkey authentication
- [ ] Test import process
- [ ] Confirm all account data accessible in new wallet
- [ ] Update any applications using your NEAR account
- [ ] Keep Communique export as backup

---

## ❓ FAQ

### Can I use multiple wallets with the same account?

**Yes.** Your NEAR account can be accessed from multiple wallets simultaneously using the same passkey authentication.

### What if I want to change my passkey?

This requires **social recovery** or support assistance. Your passkey is tied to your device's secure enclave and cannot be directly changed.

### Does migration affect my blockchain assets?

**No.** Your account state (balances, NFTs, etc.) is on NEAR blockchain. Migration only changes which wallet you use to access it.

### Can I migrate from testnet to mainnet?

**No.** Testnet accounts (`*.testnet`) and mainnet accounts are separate. You'll create a new mainnet account when Communique transitions to mainnet.

### What happens to my Communique data?

- **Blockchain data** (actions, reputation): Permanent on blockchain
- **App data** (templates, analytics): Stored in Communique database
- **Migration**: Only blockchain account migrates, app data stays with Communique

---

## 🆘 Support

### For Migration Assistance

- **Communique Support**: support@communi.email
- **NEAR Protocol**: near.org/support
- **Community**: discord.gg/near

### For Security Issues

- **Security Concerns**: security@communi.email
- **Emergency Recovery**: Use guardian system first
- **Lost Access**: Contact support with proof of ownership

---

## 📚 Additional Resources

- **NEAR Documentation**: docs.near.org
- **Passkey Authentication**: webauthn.guide
- **NEAR Wallets**: near.org/wallets
- **Account Sovereignty**: docs.near.org/concepts/basics/accounts/account-id

---

**Last Updated**: October 13, 2025
**Version**: 1.0.0
**Applies To**: Communique accounts created with passkey authentication

---

## 🎯 Key Takeaway

**You own your account.** It's a real NEAR Protocol account that works independently of Communique. Export your data, configure recovery, and you'll always maintain access regardless of what happens to Communique.
