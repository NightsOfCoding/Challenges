const { ApolloServer, gql } = require('apollo-server');
var ifsc = require('ifsc');

// Database Connection.
var pg = require('pg');
var conString = "postgres://hxhqgslu:8tcg57NzMIaRDRSrrxyJVIF0KKgLNwve@rosie.db.elephantsql.com/hxhqgslu" //Can be found in the Details page
var client = new pg.Client(conString);
client.connect(function(err) {
  if(err) {
    return console.error('could not connect to postgres', err);
  }
});

const typeDefs = gql`
  type Accounts {
    bank: String
    bank_code: String
    ifsc: String
    branch: String
    address: String
    city: String
    district: String
    state: String
    user_id: UserDetails
  }

  type UserDetails {
    success: Boolean!
    message: String
    id: Int
    name: String
    accounts: [Accounts]
  }

  type Query {
    accounts: [Accounts]
    user_details: [UserDetails]
  }

  type Mutation {
    addAccountDetails(id: Int,name: String, accounts: [String]): UserDetails
  }
`;

const resolvers = {
  Query: {
    accounts:() => {
      var result = client.query("SELECT * FROM Accounts").then(res => {
        return res.rows
      })

      return returnPromise(result)
    },
    user_details:() => {
      var result = client.query("SELECT * FROM UserDetails").then(res => {
        return res.rows
      })

      return returnPromise(result)
    }
  },
  UserDetails: {
    accounts(parent) {
      var result = client.query("SELECT * FROM Accounts where user_id = $1", [parent.id]).then(res => {
        return res.rows
      })

      return returnPromise(result)
    }
  },
  Mutation: {
    addAccountDetails: async (_, {id, name, accounts}) => {
      let usr;
      let u_acc;
      let check_user;

      await client.query("SELECT id FROM UserDetails where id = $1", [id]).then(r => {
        check_user = r.rowCount
      })

      if (check_user > 0) {
        return {
          success: false,
          message: 'User already exist',
          id: id,
          name: name
        }
      }

      await client.query('INSERT INTO UserDetails(id, name) VALUES($1, $2) RETURNING *', [id, name]).then(r => {
        console.log(r.rows[0])
        usr = r.rows[0]
      })

      if (accounts.length > 0) {

        for (let i = 0; i < accounts.length; i++) {
          let b_dt;

          if (!ifsc.validate(accounts[i])) {
            return {
              success: false,
              message: `Invalid ifsc code, Accounts not created for ${accounts[i]}`,
              id: usr.id ? usr.id : '',
              name: usr.name ? usr.name : ''
            }
          }

          await ifsc.fetchDetails(accounts[i]).then(function(r) {
            b_dt = r
          });

          if (b_dt) {
            await client.query('INSERT INTO Accounts(bank, bank_code, ifsc, branch, address, city, district, state, user_id)'+
                              'VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
                              [b_dt.BANK, b_dt.BANKCODE, b_dt.IFSC, b_dt.BRANCH, b_dt.ADDRESS, b_dt.CITY, b_dt.DISTRICT, b_dt.STATE, id]).then(r => {
                                console.log(r.rows)
                                  u_acc = r.rows
              });
          }

        }

        if (usr && u_acc.length > 0) {
          return {
            success: true,
            message: `Account Details Added`,
            id: usr.id ? usr.id : '',
            name: usr.name ? usr.name : ''
          }
        }
      }
    }
  }
};

// Common utility function to return promise.
const returnPromise = async (result) => {
  let res = await result
  return res
}

const server = new ApolloServer({ typeDefs, resolvers });

// The `listen` method launches a web server.
server.listen().then(({ url }) => {
  console.log(`🚀  Server ready at ${url}`);
});
