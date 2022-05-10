// PIFPY SDK
// Requires hashconnect

function PIFPY(testnet=false) {
	// Properties
	let version = '1.0';
    let network = testnet?'TESTNET':'MAINNET';
    let neturl  = testnet?'https://testnet.hedera.com':'https://mainnet.hedera.com';
    let address = testnet?'0x123':'0x456';

    // Methods
    function getVersion(){
    	console.log('PIFPY SDK Version '+version);
    }
    function login(){
    	console.log('Login', network);
    }
    function newUser(){}
    function setUserName(name){}
    function upload(file){}
    function setAvatar(fileId){}
    function setValue(key,value){}
    function getValue(address,key){}
    function getSelf(){}
    function getUser(address){}
    function getUserByName(name){}
    function deleteUser(){}

    // Object
    const Pifpy = {
    	// Properties
    	version: version,
    	network: network,
    	neturl: neturl,
    	address: address,
    	// Methods
    	getVersion: getVersion,
    	login: login,
		newUser: newUser,
		setUserName: setUserName,
		upload: upload,
		setAvatar: setAvatar,
		setValue: setValue,
		getValue: getValue,
		getSelf: getSelf,
		getUser: getUser,
		getUserByName: getUserByName,
		deleteUser: deleteUser
    }

    console.log('PIFPY SDK loaded');
    return Pifpy;
}

//pifpy = PIFPY();
//pifpy.version();
