import type { StudentSessionResponse } from '@exam-room/shared';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { Router } from 'express';
import { z } from 'zod';
import type { AppDependencies } from '../../app-dependencies.js';
import { badRequest, HttpError } from '../../lib/http-errors.js';
import { parseInput } from '../../lib/parse-input.js';
import { requireSessionStudent, startStudentSession } from '../student-auth/student-session.js';
import { findStudentAccount } from '../students/students-repository.js';
import { rememberChallenge, takeChallenge } from './passkey-challenge.js';
import {
  findPasskey,
  insertPasskey,
  listPasskeyIdsOfStudent,
  recordPasskeyUse,
} from './passkeys-repository.js';

const RELYING_PARTY_NAME = 'Exam Room';
const NO_OWNER_YET = 0;
const MAX_ENCODED_LENGTH = 20_000;

const encodedBytes = z.string().max(MAX_ENCODED_LENGTH);

const passkeyResponseSchema = z.looseObject({
  id: encodedBytes,
  rawId: encodedBytes,
  type: z.literal('public-key'),
  response: z.looseObject({ clientDataJSON: encodedBytes }),
  clientExtensionResults: z.looseObject({}),
});

const unknownPasskey = () =>
  new HttpError(
    401,
    'passkey_unknown',
    'This fingerprint login is not set up any more. Log in with your PIN.',
  );

export function createPasskeysRouter(dependencies: AppDependencies): Router {
  const { database, clock, config } = dependencies;
  const router = Router();
  const relyingPartyId = new URL(config.publicOrigin).hostname;

  router.post('/registration-options', async (request, response) => {
    const student = await requireSessionStudent(dependencies, request);
    const existingIds = await listPasskeyIdsOfStudent(database, student.id);
    const options = await generateRegistrationOptions({
      rpName: RELYING_PARTY_NAME,
      rpID: relyingPartyId,
      userName: `${student.schoolClass.name} · ${student.rollNumber}`,
      userDisplayName: student.name,
      userID: new TextEncoder().encode(`student-${student.id}`),
      attestationType: 'none',
      excludeCredentials: existingIds.map((id) => ({ id })),
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        residentKey: 'required',
        userVerification: 'required',
      },
    });
    rememberChallenge(response, dependencies, 'register', student.id, options.challenge);
    response.json({ options });
  });

  router.post('/registrations', async (request, response) => {
    const student = await requireSessionStudent(dependencies, request);
    const expectedChallenge = takeChallenge(
      request,
      response,
      dependencies,
      'register',
      student.id,
    );
    const registration = parseInput(passkeyResponseSchema, request.body);

    const { verified, registrationInfo } = await verifyRegistrationResponse({
      response: registration as unknown as RegistrationResponseJSON,
      expectedChallenge,
      expectedOrigin: config.publicOrigin,
      expectedRPID: relyingPartyId,
      requireUserVerification: true,
    }).catch(() => ({ verified: false, registrationInfo: undefined }));
    if (!verified || !registrationInfo) {
      throw badRequest('The fingerprint could not be set up. Please try again.', 'passkey_failed');
    }

    const { credential } = registrationInfo;
    await insertPasskey(
      database,
      {
        studentId: student.id,
        credentialId: credential.id,
        publicKey: credential.publicKey,
        signCount: credential.counter,
        transports: credential.transports ?? [],
      },
      clock.now(),
    );
    response.status(201).json({});
  });

  router.post('/login-options', async (_request, response) => {
    const options = await generateAuthenticationOptions({
      rpID: relyingPartyId,
      userVerification: 'required',
    });
    rememberChallenge(response, dependencies, 'login', NO_OWNER_YET, options.challenge);
    response.json({ options });
  });

  router.post('/login', async (request, response) => {
    const expectedChallenge = takeChallenge(request, response, dependencies, 'login', NO_OWNER_YET);
    const authentication = parseInput(passkeyResponseSchema, request.body);
    const passkey = await findPasskey(database, authentication.id);
    if (!passkey) throw unknownPasskey();

    const { verified, authenticationInfo } = await verifyAuthenticationResponse({
      response: authentication as unknown as AuthenticationResponseJSON,
      expectedChallenge,
      expectedOrigin: config.publicOrigin,
      expectedRPID: relyingPartyId,
      requireUserVerification: true,
      credential: {
        id: passkey.credentialId,
        publicKey: passkey.publicKey,
        counter: passkey.signCount,
        transports: passkey.transports,
      },
    }).catch(() => ({ verified: false, authenticationInfo: undefined }));
    if (!verified || !authenticationInfo) throw unknownPasskey();

    const account = await findStudentAccount(database, passkey.studentId);
    if (!account) throw unknownPasskey();
    await recordPasskeyUse(
      database,
      passkey.credentialId,
      authenticationInfo.newCounter,
      clock.now(),
    );
    startStudentSession(response, dependencies, account);
    response.json({ student: account.profile } satisfies StudentSessionResponse);
  });

  return router;
}
