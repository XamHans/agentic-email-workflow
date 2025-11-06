import assert from 'node:assert/strict';
import {
  parseDetailPage,
  parseSearchResults,
} from '../handelsregister/parsers';

const baseUrl = 'https://www.handelsregister.de/rp_web/';

const searchHtml = `
<!doctype html>
<html lang="de">
  <body>
    <table class="resultTable">
      <thead>
        <tr>
          <th>Firma / Name</th>
          <th>Sitz</th>
          <th>Registergericht /-nummer</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <a href="/rp_web/detail.do?op=show&register=HRB123456">Muster GmbH</a><br/>
            Rechtsform: Gesellschaft mit beschränkter Haftung
          </td>
          <td>Berlin</td>
          <td>Amtsgericht Berlin (Charlottenburg), HRB 123456</td>
        </tr>
      </tbody>
    </table>
  </body>
</html>
`;

const [listing] = parseSearchResults(searchHtml, baseUrl);
assert.ok(listing, 'Expected at least one listing');
assert.equal(listing.companyName, 'Muster GmbH');
assert.equal(listing.registerNumber, 'HRB 123456');
assert.equal(listing.court, 'Amtsgericht Berlin (Charlottenburg)');
assert.equal(listing.seat, 'Berlin');
assert.equal(
  listing.publicRegisterUrl,
  'https://www.handelsregister.de/rp_web/detail.do?op=show&register=HRB123456'
);

const detailHtml = `
<!doctype html>
<html lang="de">
  <body>
    <h1>Muster GmbH, Berlin</h1>
    <table class="companyData">
      <tr>
        <th>Registergericht</th>
        <td>Amtsgericht Berlin (Charlottenburg)</td>
      </tr>
      <tr>
        <th>Handelsregister-Nr.</th>
        <td>HRB 123456</td>
      </tr>
      <tr>
        <th>Sitz</th>
        <td>Berlin</td>
      </tr>
      <tr>
        <th>Rechtsform</th>
        <td>Gesellschaft mit beschränkter Haftung</td>
      </tr>
      <tr>
        <th>Status</th>
        <td>Aktiv</td>
      </tr>
      <tr>
        <th>Geschäftsanschrift</th>
        <td>Musterstraße 1<br/>12345 Berlin</td>
      </tr>
      <tr>
        <th>Vertretungsberechtigte</th>
        <td>Max Mustermann<br/>Erika Musterfrau</td>
      </tr>
      <tr>
        <th>Stammkapital</th>
        <td>25.000 EUR</td>
      </tr>
      <tr>
        <th>Letzte Eintragung</th>
        <td>15.02.2024</td>
      </tr>
      <tr>
        <th>Ersteintragung</th>
        <td>01.01.2015</td>
      </tr>
    </table>
  </body>
</html>
`;

const detail = parseDetailPage(
  detailHtml,
  listing.publicRegisterUrl,
  listing
);

assert.equal(detail.registerNumber, 'HRB 123456');
assert.equal(detail.court, 'Amtsgericht Berlin (Charlottenburg)');
assert.equal(detail.legalForm, 'Gesellschaft mit beschränkter Haftung');
assert.equal(detail.status, 'Aktiv');
assert.deepEqual(detail.addressLines, ['Musterstraße 1', '12345 Berlin']);
assert.deepEqual(detail.representatives, [
  'Max Mustermann',
  'Erika Musterfrau',
]);
assert.equal(detail.shareCapital, '25.000 EUR');
assert.equal(detail.lastUpdate, '15.02.2024');
assert.equal(detail.registrationDate, '01.01.2015');

console.log('✅ Handelsregister parser tests passed');
