import axios from 'axios';
import * as _ from 'lodash';
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

export interface PpNvpMap {
  [key: string]: string;
}
export interface PpNvpResponse extends PpNvpMap {
}

export interface PpNvpError {
  ERRORCODE: string;
  SHORTMESSAGE: string;
  LONGMESSAGE: string;
  SEVERITYCODE: string;
  ERRORPARAMID: string;
  ERRORPARAMVALUE: string;
}

export type PpNvpResponseWithErrorrs = PpNvpResponse & {
  ERRORS?: PpNvpError[];
};

export type PpNvpGetBalanceResponse = PpNvpResponseWithErrorrs & {
  BALANCES?: PpNvpMap[];
};

export type PpNvpTransactionSearchResponse = PpNvpResponseWithErrorrs & {
  TRANSACTIONS?: PpNvpMap[];
};

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

  static matchListField(fieldName: string): [string, number] {
    const match = listFieldMatcher.exec(fieldName);

    if (match) {
      const [listFieldName, index] = match.slice(1);
      return [listFieldName, Number(index)];
    }

    return [fieldName, -1];
  }

  static pickErrors(response: PpNvpResponse): PpNvpResponseWithErrorrs {
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

  async call(method: string, options: PpNvpMap = {}): Promise<PpNvpResponse> {
    const body = Object.assign({}, options, {
      USER: this.user,
      PWD: this.password,
      SIGNATURE: this.signature,
      METHOD: method,
      VERSION: METHOD_VERSIONS[method],
    });

    const queryResult = await axios.post(LIVE_API_URL, qs.stringify(body), {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    })

    const parsedResult = qs.parse(queryResult.data);

    return PpNvp.pickErrors(parsedResult);
  }

  async getBalance(options?: PpNvpMap): Promise<PpNvpGetBalanceResponse> {
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

  async getTransactionDetails(options?: PpNvpMap): Promise<PpNvpResponseWithErrorrs> {
    const method = 'GetTransactionDetails';
    return await this.call(method, options);
  }

  async transactionSearch(options?: PpNvpMap): Promise<PpNvpTransactionSearchResponse> {
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
