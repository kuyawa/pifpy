// PIFPY

const fs           = require('fs');
const path         = require('path');
//const fetch        = require('node-fetch');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const ejs          = require('ejs');
const express      = require('express');
const uploader     = require('express-fileupload');
const bodyParser   = require('body-parser');
const cookieParser = require('cookie-parser');
const api          = require('./api.js');
const DB           = require('./database.js'); 


var config = {
    network:     process.env.NETWORK,
    explorer:    process.env.EXPLORER,
    theme:       'dark-mode',
};


async function main(){
    let now = new Date();
    console.warn(now, 'PIFPY is running on', process.env.NETWORK);
    const app = express();
    app.use(express.static(path.join(__dirname, 'public')));
    app.use(uploader());
    //app.use(express.json()) // Instead of bodyParser since express 4.16
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(cookieParser());
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'html');
    app.engine('html', ejs.renderFile);


    //---- ROUTER

    //if(settings.maintenance=='ON'){
    //    app.get('*', (req, res) => { 
    //        res.render('maintenance.html', {config}); // Catch all
    //    });
    //}

    app.get('/', async (req, res) => { 
        try {
            config.user = req.cookies.user;
            let list = await DB.getLatestProfiles(5);
            res.render('index.html', {config, list});
        } catch(ex) {
            console.error(new Date(), 'Server error', ex.message);
            return res.status(500).render('serverror.html');
        }
    });
    
    app.get('/create', async (req, res) => { 
        try {
            //config.user = req.cookies.user;
            res.render('create.html', config);
        } catch(ex) {
            console.error(new Date(), 'Server error', ex.message);
            return res.status(500).render('serverror.html');
        }
    });

    app.get('/explore', async (req, res) => { 
        try {
            config.user = req.cookies.user;
            let list = await DB.getLatestProfiles();
            res.render('explore.html', {config, list});
        } catch(ex) {
            console.error(new Date(), 'Server error', ex.message);
            return res.status(500).render('serverror.html');
        }
    });

    app.get('/market', async (req, res) => { 
        try {
            config.user = req.cookies.user;
            let list = await DB.getProfilesOnSale();
            res.render('market.html', {config, list});
        } catch(ex) {
            console.error(new Date(), 'Server error', ex.message);
            return res.status(500).render('serverror.html');
        }
    });

    app.get('/profile', async (req, res) => { 
        console.warn('/profile', req.cookies.user);
        try {
            config.user = req.cookies.user;
            if(!req.cookies.user){
                console.warn('redirect /create');
                res.redirect('/create');
                return;
            }
            //let profile = await api.getUserById(config.user); // From contract
            let profile = await DB.getProfile(config.user); // From DB
            if(!profile || profile.error || profile.created=='0'){
                console.warn('redirect /create');
                res.redirect('/create');
            } else {
                console.warn('Metadata', profile.metadata);
                if(profile.metadata) { profile.metadata = JSON.parse(profile.metadata); }
                res.render('profile.html', {config, profile});
            }
        } catch(ex) {
            console.error(new Date(), 'Server error', ex.message);
            return res.status(500).render('serverror.html');
        }
    });

    app.get('/profile/:user', async (req, res) => { 
        let user = req.params.user;
        console.warn('/profile/'+user);
        try {
            config.user = req.cookies.user;
            let profile = null;
            if(user.startsWith('0.')){
                profile = await DB.getProfile(user);
            } else {
                profile = await DB.getProfileByName(user.toLowerCase());
            }
            if(!profile || profile.error || profile.created=='0'){
                console.warn('profile notfound');
                res.status(404).render('notfound.html')
                return;
            } else {
                if(profile.metadata) { profile.metadata = JSON.parse(profile.metadata); }
                res.render('profview.html', {config, profile});
            }
        } catch(ex) {
            console.error(new Date(), 'Server error', ex.message);
            return res.status(500).render('serverror.html');
        }
    });

    app.get('/faq', async (req, res) => { 
        try {
            config.user = req.cookies.user;
            res.render('faq.html', config);
        } catch(ex) {
            console.error(new Date(), 'Server error', ex.message);
            return res.status(500).render('serverror.html');
        }
    });

    app.get('/verify/:tx', async (req, res) => { 
        let tx = req.params.tx;
        console.warn('Received tx', tx);
        let token = await api.verifySignature(tx);
        res.end('ok:'+token);
    });
    

    //---- API

    app.get('/api/checkname/:name', async (req, res) => { 
        let name = req.params.name;
        console.warn('Name:', name);
        let inf = await api.checkName(name);
        console.warn('Valid?', inf);
        res.end(JSON.stringify(inf));
    });

    app.get('/api/getself', async (req, res) => { 
        let act = req.cookies.user;
        console.warn('/self', act);
        if(!act){
            console.warn('No user cookie');
            return res.send(JSON.stringify({error:'User not logged in'}));
        }

        let inf = await DB.getProfile(act);
        console.warn('Self', inf);
        if(inf.error){
            return res.send(JSON.stringify(inf));
        }
        if(!inf){
            return res.send(JSON.stringify({ok:true}));
        }
        res.send(JSON.stringify({ok:false}));
    });

    app.get('/api/profile/:actid', async (req, res) => { 
        let actid = req.params.actid;
        console.warn('/api/profile', actid);
        let inf = await DB.getProfile(actid);
        console.warn('Profile', inf);
        if(!inf){
            return res.send(JSON.stringify({error:'Profile not found'}));
        }
        res.send(JSON.stringify(inf));
    });

    app.get('/api/freeze', async (req, res) => {
        //let tx = req.body;
        let tx = '?';
        let rx = await api.signAndBuild(tx);
        res.send(JSON.stringify(rx));
    });

    app.get('/api/txnewuser/:name/:avatar', async (req, res) => {
        let name = req.params.name;
        let avtr = req.params.avatar;
        let rex  = await api.txNewUser(name, avtr);
        res.send(JSON.stringify(rex));
    });

    app.get('/api/newuser/:name/:avatar', async (req, res) => {
        let actid = req.cookies.user;
        let name  = req.params.name;
        let avtr  = req.params.avatar;
        console.warn('/api/newuser', actid, name, avtr);
        if(!actid){ return res.send(JSON.stringify({error:'User not logged in'})); }
        let rex   = await DB.newProfile({actid:actid, username:name, avatar:avtr});
        console.warn('New profile', actid, name, avtr, rex);
        res.send(JSON.stringify(rex));
    });

    app.post('/api/upload/:fileid', async (req, res) => {
        let fileId = req.params.fileid;
        console.warn('FileId', fileId);
        try {
            if (!req.files || !req.files.file) { return res.send(JSON.stringify({error:'No files uploaded'})); }
            let file = req.files.file;
            console.warn('File', req.files.file);
            if(!req.files.file.name){ return res.send(JSON.stringify({error:'No files uploaded'})); }
            let fileName  = req.files.file.name;
            console.warn('File name', req.files.file.name)
            let folder = path.join(__dirname, 'public/media/avatars/');
            let filePath = folder+fileId;
            //console.warn('Body', req.body);
            console.warn('Uploading image...')
            file.mv(filePath, function(err) {
                if (err) { return res.send(JSON.stringify({error:err})); }
                //console.warn('Thumbnail for', fileName, coverType);
                //let thumb = path.join(__dirname, 'public/thumbs/'+fileId);
                //thumbit(filePath, thumb);
                //console.warn('Thumb created');
            });
            console.warn('Uploaded');
            res.send(JSON.stringify({name:fileId}));
        } catch(ex) {
            console.error(new Date(), 'Upload error:', ex);
            res.send(JSON.stringify({error:'Server error: '+(ex.message||ex)}));
        }
    });

    app.post('/api/metadata', async (req, res) => {
        let meta = req.body;
        console.warn('Body', meta);
        let user = req.cookies.user;
        console.warn('User', user);
        if(!user) { return res.send(JSON.stringify({error:'User not found'})); }
        let ok = await DB.modProfile({actid:user, metadata:JSON.stringify(meta)});
        if(!ok){ return res.send(JSON.stringify({error:'Error saving metadata'})); }
        res.send(JSON.stringify({status:'success'}));
    });

    app.get('/api/setprice/:price', async (req, res) => {
        let user  = req.cookies.user;
        let price = req.params.price;
        console.warn('User', user);
        console.warn('Price', price);
        if(!user) { return res.send(JSON.stringify({error:'User not found'})); }
        let ok = await DB.modProfile({actid:user, price:price});
        if(!ok){ return res.send(JSON.stringify({error:'Error saving price'})); }
        res.send(JSON.stringify({status:'success'}));
    });

    app.get('/api/transfer/:actid', async (req, res) => {
        let source = req.cookies.user; // From user to someone
        let destin = req.params.actid;
        console.warn('/api/transfer', source, destin);
        if(!source) { return res.send(JSON.stringify({error:'User not logged in'})); }
        let pfp = await DB.getProfile(destin);
        console.warn('Destin', pfp);
        if(pfp){ return res.send(JSON.stringify({error:'Destin profile found'})); }
        let ok = await DB.transferProfile(source, destin);
        if(!ok){ return res.send(JSON.stringify({error:'Error transferring profile'})); }
        res.send(JSON.stringify({status:'success'}));
    });

    app.get('/api/buy/:actid', async (req, res) => {
        let seller = req.params.actid; // From someone to user
        let buyer  = req.cookies.user;
        console.warn('/api/buy', seller, buyer);
        if(!buyer) { return res.send(JSON.stringify({error:'User not logged in'})); }
        let pfp = await DB.getProfile(buyer);
        console.warn('Buyer', pfp);
        if(pfp){ return res.send(JSON.stringify({error:'Buyer profile found'})); }
        let ok = await DB.transferProfile(seller, buyer);
        if(!ok){ return res.send(JSON.stringify({error:'Error buying profile'})); }
        res.send(JSON.stringify({status:'success'}));
    });

    app.get('/api/delete', async (req, res) => {
        let actid = req.cookies.user;
        console.warn('Actid', actid);
        if(!actid) { return res.send(JSON.stringify({error:'User not loged in'})); }
        let rex = await DB.deleteProfile(actid);
        console.warn('Deleted', rex);
        if(rex.error){ return res.send(JSON.stringify(rex)); }
        res.send(JSON.stringify({status:'success'}));
    });


    // More stuff here

    app.get('/notfound', (req, res) => { 
        res.status(404).render('notfound.html'); // Catch all
        //res.status(404).end('404 - Resource not found'); // Catch all
    });

    app.get('*', (req, res) => { 
        res.status(404).render('notfound.html'); // Catch all
        //res.status(404).end('404 - Resource not found'); // Catch all
    });

    app.listen(5000);
    //app.listen();
}

main();

// END