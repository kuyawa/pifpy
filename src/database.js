// DATABASE

const postgres = require('pg');
const dbconn   = process.env.DATABASE;
if(!dbconn){ console.error('DATASERVER NOT AVAILABLE'); }
const dbp = new postgres.Pool({ connectionString: dbconn });


const schema = {
    tables:{
        profiles: {
            primaryKey: 'pid',
            accessKey: 'actid',
            fields: ['pid', 'created', 'actid', 'username', 'avatar', 'onsale', 'price', 'inactive', 'metadata']
        }
    }
}

class DataServer {
    async connect() {}
    async disconnect() {}

    async insert(sql, params, key) {
        var dbc, res, recid, data = null;
        try {
            dbc = await dbp.connect();
            res = await dbc.query(sql, params);
            if(res.rowCount>0) { 
                recid = key?res.rows[0][key]:0;
                data  = { status:'OK', id: recid }; 
            }
        } catch(ex) {
            console.error('DB error on new record:', ex.message);
            data = { error: ex.message };
        } finally {
            if (dbc) { dbc.release(); }
        }
        return data;
    }

    async update(sql, params) {
        var dbc, res, data = null;
        try {
            dbc = await dbp.connect();
            res = await dbc.query(sql, params);
            if(res.rowCount>0) {
                data = true;
            } else { 
                data = false;
            }
        } catch(ex) {
            console.error('DB error updating records:', ex.message);
            data = { error: ex.message };
        } finally {
            if (dbc) { dbc.release(); }
        }
        return data;
    }

    async query(sql, params) {
        var dbc, res, data = null;
        try {
            dbc = await dbp.connect();
            res = await dbc.query(sql, params);
            if(res.rows.length>0) { 
                data = res.rows;
            } else {
                data = [];
            }
        } catch(ex) {
            console.error('DB error in query:', ex.message);
            data = { error: ex.message };
        } finally {
            if (dbc) { dbc.release(); }
        }
        return data;
    }

    async queryObject(sql, params) {
        var dbc, res, data = null;
        try {
            dbc = await dbp.connect();
            res = await dbc.query(sql, params);
            if(res.rows.length>0) { 
                data = res.rows[0];
            }
        } catch(ex) {
            console.error('DB error getting data object:', ex.message);
            data = { error: ex.message };
        } finally {
            if (dbc) { dbc.release(); }
        }
        return data;
    }

    async queryValue(sql, params) {
        var dbc, res, data = null;
        try {
            dbc = await dbp.connect();
            res = await dbc.query(sql, params);
            if(res.rows.length>0) { 
                data = res.rows[0].value; // Select should have field as value
            }
        } catch(ex) {
            console.error('DB error getting data value:', ex.message);
            data = { error: ex.message };
        } finally {
            if (dbc) { dbc.release(); }
        }
        return data;
    }
}


const DS = new DataServer();

//---- UTILS

function parseFields(flds, excl) {
    console.warn('Parse sql', flds, excl);
    let fields = [];
    for (var i = 0; i < flds.length; i++) {
        if(excl[i].indexOf(flds[i])>=0) { continue; }
        fields.push(flds[i]);
    }
    console.warn('Parsed', fields);
    return fields.join(',');
}

function parseInsert(table, flds, excl, key, rec) {
    let npos = 0
    let arrf = [];
    let arrv = [];
    let data = [];
    let keys = Object.keys(rec)
    for (var i = 0; i < keys.length; i++) {
        if(excl.indexOf(keys[i])>=0) { continue; }
        if(flds.indexOf(keys[i])>=0){ 
            npos++; 
            arrf.push(keys[i]); 
            arrv.push('$'+npos); 
            data.push(rec[keys[i]]); 
        }
    }
    let fields = arrf.join(',');
    let values = arrv.join(',');
    let sql = `insert into ${table}(${fields}) values(${values}) returning ${key}`;
    //console.error('SQL', sql);
    //console.error('DATA', data);
    if(npos<1){ return null; } else { return {sql:sql, data:data }; }
}

function parseUpdate(table, flds, excl, key, rec) {
    //console.warn('Input', table, flds, excl, key, rec);
    let npos = 1; // first value is primary key
    let arrf = [];
    let arrv = [];
    let data = [];
    let keys = Object.keys(rec)
    for (var i = 0; i < keys.length; i++) {
        //console.warn('Key', keys[i], rec[keys[i]]);
        if(excl.indexOf(keys[i])>=0) { continue; }
        if(keys[i]==key){ 
            //console.warn('Key2', rec[keys[i]]);
            data.unshift(rec[keys[i]]); 
            continue;
        }
        if(flds.indexOf(keys[i])>=0){ 
            npos++; 
            arrf.push(keys[i]+'=$'+npos); 
            data.push(rec[keys[i]]); 
        }
    }
    let fields = arrf.join(', ');
    let sql = `update ${table} set ${fields} where ${key} = $1`;
    console.error('SQL', sql);
    console.error('DAT', data);
    if(npos<1){ return null; } else { return {sql:sql, data:data }; }
}



// Get server tiime to test connectivity
async function getTime() { 
    let sql  = 'SELECT NOW() as value';
    let data = await DS.queryValue(sql);
    return data;
}


//---- CONFIG

async function getSettings() {
    let sql  = 'Select * From config';
    let info = await DS.query(sql);
    let data = {};
    for (var i = 0; i < info.length; i++) {
        switch(info[i].type){
            case 'i': data[info[i].name] = parseInt(info[i].value)   || 0;    break;
            case 'f': data[info[i].name] = parseFloat(info[i].value) || 0.0;  break;
            case 'd': data[info[i].name] = new Date(info[i].value)   || null; break;
            case 'o': data[info[i].name] = JSON.parse(info[i].value) || null; break;
            default : data[info[i].name] = info[i].value             || '';   break;
        }
    }
    return data;
}

async function getConfig(name) {
    let sql  = 'Select value From config Where name=$1';
    let pars = [name];
    let data = await DS.queryValue(sql, pars);
    return data;
}

async function setConfig(name, value) {
    let sql  = 'Update config Set value = $2 Where name=$1';
    let pars = [name, value];
    let data = await DS.update(sql, pars);
    return data;
}


//---- PROFILES

async function newProfile(rec) { 
    let fields = schema.tables.profiles.fields;
    let key    = schema.tables.profiles.primaryKey;
    let except = [key];
    let parsed = parseInsert('profiles', fields, except, key, rec);
    let sql    = parsed.sql;
    let params = parsed.data;
    let data   = await DS.insert(sql, params, key);
    return data;
}

async function getProfile(actid) {
    let sql  = 'SELECT * FROM profiles WHERE actid = $1';
    let pars = [actid];
    let data = await DS.queryObject(sql, pars);
    return data;
}

async function getProfileByName(name) {
    let sql  = 'SELECT * FROM profiles WHERE username = $1';
    let pars = [name];
    let data = await DS.queryObject(sql, pars);
    return data;
}

async function modProfile(rec) { 
    let key    = schema.tables.profiles.accessKey;
    let fields = schema.tables.profiles.fields;
    let except = ['pid', 'created'];
    let parsed = parseUpdate('profiles', fields, except, key, rec);
    let sql    = parsed.sql;
    let params = parsed.data;
    let data   = await DS.update(sql, params);
    return data;
}

async function getLatestProfiles(limit=100) {
    let sql  = 'SELECT * FROM profiles WHERE NOT inactive ORDER BY created desc LIMIT $1';
    let pars = [limit];
    let data = await DS.query(sql, pars);
    return data;
}

async function getProfilesOnSale(limit=100) {
    let sql  = 'SELECT * FROM profiles WHERE price>0 AND NOT inactive ORDER BY created desc LIMIT $1';
    let pars = [limit];
    let data = await DS.query(sql, pars);
    return data;
}

async function setProfileInactive(actid) { 
    let sql  = 'Update profiles set inactive = true where actid = $1';
    let pars = [actid];
    let data = await DS.update(sql, pars);
    return data;
}

async function transferProfile(actid, destin) { 
    let sql  = 'Update profiles set actid=$2, price=0, metadata=null where actid = $1';
    let pars = [actid, destin];
    let data = await DS.update(sql, pars);
    return data;
}



//---- EXPORTS

module.exports = {
    getTime,
    newProfile,
    getProfile,
    getProfileByName,
    modProfile,
    getLatestProfiles,
    getProfilesOnSale,
    setProfileInactive
}


// END