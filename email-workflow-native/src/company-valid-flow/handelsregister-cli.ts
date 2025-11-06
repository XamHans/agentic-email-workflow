import { fetchHandelsregisterRecord } from './handelsregister-service';

function log(...args: unknown[]) {
  console.log('[handelsregister-cli]', ...args);
}

async function main() {
  const [, , registerNumberArg, ...nameParts] = process.argv;

  if (!registerNumberArg) {
    console.error(
      'Usage: pnpm exec ts-node src/company-valid-flow/handelsregister-cli.ts <registerNumber> [company name]'
    );
    process.exitCode = 1;
    return;
  }

  const legalName = nameParts.length ? nameParts.join(' ') : undefined;

  log(
    `Looking up register number "${registerNumberArg}"${
      legalName ? ` (name hint: ${legalName})` : ''
    }`
  );

  const record = await fetchHandelsregisterRecord(
    registerNumberArg,
    legalName,
    log
  );

  if (!record) {
    console.error('No Handelsregister record found.');
    process.exitCode = 2;
    return;
  }

  console.log(
    JSON.stringify(
      {
        companyName: record.companyName,
        registerNumber: record.registerNumber,
        court: record.court,
        status: record.status,
        legalForm: record.legalForm,
        seat: record.seat,
        representatives: record.representatives,
        publicRegisterUrl: record.publicRegisterUrl,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error('Handelsregister lookup failed:', error);
  process.exitCode = 99;
});
