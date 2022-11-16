
import util from './helpers'
import SignalProtocolStore from "./InMemorySignalProtocolStore";

const libsignal = window.libsignal

export class SignalServerStore {

    registerNewPreKeyBundle(userId, preKeyBundle) {
        let storageBundle = { ...preKeyBundle }
        storageBundle.identityKey = util.arrayBufferToBase64(storageBundle.identityKey)
        storageBundle.preKey.publicKey = util.arrayBufferToBase64(storageBundle.preKey.publicKey)
        storageBundle.signedPreKey.publicKey = util.arrayBufferToBase64(storageBundle.signedPreKey.publicKey)
        storageBundle.signedPreKey.signature = util.arrayBufferToBase64(storageBundle.signedPreKey.signature)
        localStorage.setItem(userId, JSON.stringify(storageBundle))
        // this.store[userId] = preKeyBundle;
    }


    getPreKeyBundle(userId) {
        console.log("dsff")
        let storageBundle = JSON.parse(localStorage.getItem(userId))
        storageBundle.identityKey = util.base64ToArrayBuffer(storageBundle.identityKey)
        storageBundle.preKey.publicKey = util.base64ToArrayBuffer(storageBundle.preKey.publicKey)
        storageBundle.signedPreKey.publicKey = util.base64ToArrayBuffer(storageBundle.signedPreKey.publicKey)
        storageBundle.signedPreKey.signature = util.base64ToArrayBuffer(storageBundle.signedPreKey.signature)
        return storageBundle

    }
}


class SignalProtocolManager {
    constructor(userId, signalServerStore) {
        this.userId = userId;
        this.store = new SignalProtocolStore();
        this.signalServerStore = signalServerStore;
    }
    async initializeAsync() {
        await this._generateIdentityAsync();

        var preKeyBundle = await this._generatePreKeyBundleAsync();

        this.signalServerStore.registerNewPreKeyBundle(this.userId, preKeyBundle);
    }



    async encryptMessageAsync(remoteUserId, message) {
        var sessionCipher = this.store.loadSessionCipher(remoteUserId);
        if (sessionCipher == null) {
            var address = new libsignal.SignalProtocolAddress(remoteUserId, 123);

            var sessionBuilder = new libsignal.SessionBuilder(this.store, address);

            var remoteUserPreKey = this.signalServerStore.getPreKeyBundle(remoteUserId);

            await sessionBuilder.processPreKey(remoteUserPreKey);

            var sessionCipher = new libsignal.SessionCipher(this.store, address);
            this.store.storeSessionCipher(remoteUserId, sessionCipher);
        }

        let cipherText = await sessionCipher.encrypt(util.toArrayBuffer(message));
        return cipherText
    }


    async decryptMessageAsync(remoteUserId, cipherText) {
        var sessionCipher = this.store.loadSessionCipher(remoteUserId);
        if (sessionCipher == null) {
            var address = new libsignal.SignalProtocolAddress(remoteUserId, 123);
            var sessionCipher = new libsignal.SessionCipher(this.store, address);
            this.store.storeSessionCipher(remoteUserId, sessionCipher);
        }

        var messageHasEmbeddedPreKeyBundle = cipherText.type == 3;

        if (messageHasEmbeddedPreKeyBundle) {
            var decryptedMessage = await sessionCipher.decryptPreKeyWhisperMessage(cipherText.body, 'binary');
            return util.toString(decryptedMessage);
        } else {
            var decryptedMessage = await sessionCipher.decryptWhisperMessage(cipherText.body, 'binary');
            return util.toString(decryptedMessage);
        }
    }


    async _generateIdentityAsync() {
        var results = await Promise.all([
            libsignal.KeyHelper.generateIdentityKeyPair(),
            libsignal.KeyHelper.generateRegistrationId(),
        ]);

        this.store.put('identityKey', results[0]);
        this.store.put('registrationId', results[1]);
    }

    async _generatePreKeyBundleAsync() {
        var result = await Promise.all([
            this.store.getIdentityKeyPair(),
            this.store.getLocalRegistrationId()
        ]);

        let identity = result[0];
        let registrationId = result[1];

        var keys = await Promise.all([
            libsignal.KeyHelper.generatePreKey(registrationId + 1),
            libsignal.KeyHelper.generateSignedPreKey(identity, registrationId + 1)
        ]);

        let preKey = keys[0]
        let signedPreKey = keys[1];

        await this.store.storePreKey(preKey.keyId, preKey.keyPair);
        await this.store.storeSignedPreKey(signedPreKey.keyId, signedPreKey.keyPair);

        return {
            identityKey: identity.pubKey,
            registrationId: registrationId,
            preKey: {
                keyId: preKey.keyId,
                publicKey: preKey.keyPair.pubKey
            },
            signedPreKey: {
                keyId: signedPreKey.keyId,
                publicKey: signedPreKey.keyPair.pubKey,
                signature: signedPreKey.signature
            }
        };
    }
}

export async function createSignalProtocolManager(userid, name, dummySignalServer) {
    let signalProtocolManagerUser = new SignalProtocolManager(userid, dummySignalServer);
    await Promise.all([
        signalProtocolManagerUser.initializeAsync(),
    ]);
    return signalProtocolManagerUser
}




