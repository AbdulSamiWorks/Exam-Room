import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from 'node:crypto';

type JsonOptions = {
  challenge: string;
  rp?: { id?: string };
  rpId?: string;
  user?: { id: string };
};

const FLAG_USER_PRESENT = 0x01;
const FLAG_USER_VERIFIED = 0x04;
const FLAG_ATTESTED_CREDENTIAL = 0x40;
const COSE_KEY_TYPE_EC2 = 2;
const COSE_ALGORITHM_ES256 = -7;
const COSE_CURVE_P256 = 1;

export function createSoftwareAuthenticator(origin: string) {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const credentialId = randomBytes(16);
  let signCount = 0;
  let userHandle = '';

  function authenticatorData(relyingPartyId: string, flags: number, extra = Buffer.alloc(0)) {
    const counter = Buffer.alloc(4);
    counter.writeUInt32BE(signCount);
    return Buffer.concat([
      sha256(Buffer.from(relyingPartyId)),
      Buffer.from([flags]),
      counter,
      extra,
    ]);
  }

  return {
    credentialId: credentialId.toString('base64url'),

    register(options: JsonOptions) {
      userHandle = options.user?.id ?? '';
      const clientData = clientDataJson('webauthn.create', options.challenge, origin);
      const attestedCredential = Buffer.concat([
        Buffer.alloc(16),
        lengthPrefix(credentialId.length),
        credentialId,
        coseKeyOf(publicKey),
      ]);
      const authData = authenticatorData(
        options.rp?.id ?? '',
        FLAG_USER_PRESENT | FLAG_USER_VERIFIED | FLAG_ATTESTED_CREDENTIAL,
        attestedCredential,
      );
      const attestationObject = cborMap([
        [cborText('fmt'), cborText('none')],
        [cborText('attStmt'), cborMap([])],
        [cborText('authData'), cborBytes(authData)],
      ]);
      return {
        id: credentialId.toString('base64url'),
        rawId: credentialId.toString('base64url'),
        type: 'public-key',
        response: {
          clientDataJSON: clientData.toString('base64url'),
          attestationObject: attestationObject.toString('base64url'),
          transports: ['internal'],
        },
        clientExtensionResults: {},
        authenticatorAttachment: 'platform',
      };
    },

    authenticate(options: JsonOptions) {
      signCount += 1;
      const clientData = clientDataJson('webauthn.get', options.challenge, origin);
      const authData = authenticatorData(
        options.rpId ?? '',
        FLAG_USER_PRESENT | FLAG_USER_VERIFIED,
      );
      const signature = sign('sha256', Buffer.concat([authData, sha256(clientData)]), privateKey);
      return {
        id: credentialId.toString('base64url'),
        rawId: credentialId.toString('base64url'),
        type: 'public-key',
        response: {
          clientDataJSON: clientData.toString('base64url'),
          authenticatorData: authData.toString('base64url'),
          signature: signature.toString('base64url'),
          userHandle,
        },
        clientExtensionResults: {},
        authenticatorAttachment: 'platform',
      };
    },
  };
}

function clientDataJson(type: string, challenge: string, origin: string): Buffer {
  return Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }));
}

function sha256(data: Buffer): Buffer {
  return createHash('sha256').update(data).digest();
}

function lengthPrefix(length: number): Buffer {
  const prefix = Buffer.alloc(2);
  prefix.writeUInt16BE(length);
  return prefix;
}

function coseKeyOf(publicKey: KeyObject): Buffer {
  const jwk = publicKey.export({ format: 'jwk' });
  return cborMap([
    [cborInteger(1), cborInteger(COSE_KEY_TYPE_EC2)],
    [cborInteger(3), cborInteger(COSE_ALGORITHM_ES256)],
    [cborInteger(-1), cborInteger(COSE_CURVE_P256)],
    [cborInteger(-2), cborBytes(Buffer.from(jwk.x ?? '', 'base64url'))],
    [cborInteger(-3), cborBytes(Buffer.from(jwk.y ?? '', 'base64url'))],
  ]);
}

function cborHeader(majorType: number, length: number): Buffer {
  if (length < 24) return Buffer.from([(majorType << 5) | length]);
  if (length < 256) return Buffer.from([(majorType << 5) | 24, length]);
  return Buffer.concat([Buffer.from([(majorType << 5) | 25]), lengthPrefix(length)]);
}

function cborInteger(value: number): Buffer {
  return value >= 0 ? cborHeader(0, value) : cborHeader(1, -1 - value);
}

function cborBytes(bytes: Buffer): Buffer {
  return Buffer.concat([cborHeader(2, bytes.length), bytes]);
}

function cborText(text: string): Buffer {
  const bytes = Buffer.from(text);
  return Buffer.concat([cborHeader(3, bytes.length), bytes]);
}

function cborMap(entries: Array<[Buffer, Buffer]>): Buffer {
  return Buffer.concat([cborHeader(5, entries.length), ...entries.flat()]);
}
