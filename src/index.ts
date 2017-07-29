import * as _ from 'lodash';
import * as got from 'got';
import * as qs from 'query-string';


const LIVE_API_URL = 'https://api-3t.paypal.com/nvp';
const COMMON_RESPONSE_FIELDS = [
  'ACK',
  'CORRELATIONID',
  'TIMESTAMP',
  'VERSION',
  'BUILD',
];
const ERROR_MESSAGE_FIELDS = [
  'ERRORCODE',
  'SHORTMESSAGE',
  'LONGMESSAGE',
  'SEVERITYCODE',
  'ERRORPARAMID',
  'ERRORPARAMVALUE',
];

const METHOD_VERSIONS = {
  GetBalance: '204',
  GetTransactionDetails: '204',
  TransactionSearch: '204',
};

const RESPONSE_MESSAGE_FIELDS = {
  GetBalance: [
    'AMT',
    'CURRENCYCODE',
  ],
  GetTransactionDetails: [],
  TransactionSearch: [
    'TIMESTAMP',
    'TIMEZONE',
    'TYPE',
    'EMAIL',
    'NAME',
    'TRANSACTIONID',
    'STATUS',
    'AMT',
    'CURRENCYCODE',
    'FEEAMT',
    'NETAMT',
  ],
};

const listFieldMatcher = /^L_([A-Z]+)([0-9]+)$/;

export default class PpNvp {

  private user: string;
  private password: string;
  private signature: string;

  constructor({
    user,
    password,
    signature,
  }) {
    this.user = user;
    this.password = password;
    this.signature = signature;
  }

  static matchListField(fieldName: string) {
    const match = listFieldMatcher.exec(fieldName);

    if (match) {
      const [listFieldName, index] = match.slice(1);
      return [listFieldName, Number(index)];
    }

    return [fieldName, -1];
  }

  static pickErrors(response) {
    return _.reduce(
      response,
      (result, value, name) => {
        const [field, index] = PpNvp.matchListField(name);

        if (index > -1) {
          if (_.includes(ERROR_MESSAGE_FIELDS, field)) {
            return _.set(result, `ERRORS[${index}].${field}`, value);
          }
        }

        return _.set(result, name, value);
      },
      {},
    );
  }

  async call(method, options = {}) {
    const body = Object.assign({}, options, {
      USER: this.user,
      PWD: this.password,
      SIGNATURE: this.signature,
      METHOD: method,
      VERSION: METHOD_VERSIONS[method],
    });

    const queryResult = await got.post(LIVE_API_URL, {
      body,
      form: true,
    });

    const parsedResult = qs.parse(queryResult.body);

    return PpNvp.pickErrors(parsedResult);
  }

  async getBalance(options) {
    const method = 'GetBalance';
    const rawResult = await this.call(method, options);

    return _.reduce(
      rawResult,
      (result, value, name) => {
        const [field, index] = PpNvp.matchListField(name);

        if (index > -1) {
          if (_.includes(RESPONSE_MESSAGE_FIELDS[method], field)) {
            return _.set(result, `BALANCES[${index}].${field}`, value);
          }
        }

        return _.set(result, name, value);
      },
      {},
    );
  }

  async getTransactionDetails(options) {
    const method = 'GetTransactionDetails';
    return await this.call(method, options);
  }

  async transactionSearch(options) {
    const method = 'TransactionSearch';
    const rawResult = await this.call(method, options);

    return _.reduce(
      rawResult,
      (result, value, name) => {
        const [field, index] = PpNvp.matchListField(name);

        if (index > -1) {
          if (_.includes(RESPONSE_MESSAGE_FIELDS[method], field)) {
            return _.set(result, `TRANSACTIONS[${index}].${field}`, value);
          }
        }

        return _.set(result, name, value);
      },
      {},
    );
  }

}

const nvp = new PpNvp({
  user: 'kontakt_api1.ajwserwis.pl',
  password: '2ABPZWXRCJ6HFNXY',
  signature: 'Adnj6Dgi--0rqvIOX-OYpXvO6bj-AnTWbUA6XDsLw1f5wGrxy56IIKph',
});

// nvp.getBalance({
//   RETURNALLCURRENCIES: 1,
// }).then(console.log);

nvp.getTransactionDetails({
  TRANSACTIONID: '6D330934C12720130',
}).then(console.log);

// nvp.transactionSearch({
//   STARTDATE: '2017-07-29T00:00:00Z',
// }).then(console.log);
