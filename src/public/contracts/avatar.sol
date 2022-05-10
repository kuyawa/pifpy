// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

contract Avatar {


//- LOGS

    event logBlank(address indexed user, uint amount, uint stamp);
    event logNew(address indexed user, string indexed name, string indexed avatar, uint amount, uint stamp);
    event logDel(address indexed user, string indexed name, uint stamp);
    event logName(address indexed user, string indexed name, uint stamp);
    event logTransfer(address indexed source, address indexed destin, string indexed name, uint stamp);
    event logBuy(address indexed seller, address indexed buyer, string indexed name, uint price, uint stamp);


//- VARS

    struct User {
        uint     created;
        address  userId;
        string   userName;
        string   avatar;
        uint     price;
        string[] keys;                       // meta keys
        mapping(string => string) metadata;  // meta values
    }

    mapping(address => User)   internal Users;      // address:User per user
    mapping(string => address) internal UserNames;  // username:address

    bool    private  mutex;                      // reentry check
    address internal operator;                   // admin account
    address payable  public treasury;            // collector

    uint USERFEE1 = 1000;  // FEES 1 CHAR
    uint USERFEE2 =  500;
    uint USERFEE3 =  100;
    uint USERFEE4 =   50;
    uint USERFEE5 =   10;
    uint USERFEES =    1;


//- MODS

    modifier admin() {
        require(msg.sender==operator, 'ERR_UNAUTHORIZED');
        _;
    }

    modifier lock() {
        require(!mutex, "ERR_INVALIDREENTRY");
        mutex = true;
        _;
        mutex = false;
    }

    modifier vlock() {
        require(!mutex, "ERR_INVALIDREENTRY");
        _;
    }


//- UTILS

    function alphaNum(string memory txt) internal pure returns (bool) {
        // username must be ascii a-z and less than 20 chars
        bytes memory b = bytes(txt);
        if(b.length > 20) return false;

        for(uint i=0; i<b.length; i++){
            bytes1 char = b[i];
            if( i==0 && (char >= 0x30 && char <= 0x39) ){ return false; }
            if(
                !(char >= 0x30 && char <= 0x39) && //9-0
                !(char >= 0x41 && char <= 0x5A) && //A-Z
                !(char >= 0x61 && char <= 0x7A)    //a-z
            ){ return false; }
        }
        return true;
        // use char 0x2E dot ?
    }

    function lowerCase(string memory txt) internal pure returns (string memory) {
        bytes memory bStr = bytes(txt);
        bytes memory bLow = new bytes(bStr.length);
        for (uint i=0; i < bStr.length; i++) {
            if ((uint8(bStr[i]) >= 65) && (uint8(bStr[i]) <= 90)) {
                bLow[i] = bytes1(uint8(bStr[i]) + 32);
            } else {
                bLow[i] = bStr[i];
            }
        }
        return string(bLow);
    }

    function cat2(string memory s1, string memory s2) internal pure returns (string memory) {
        return string(abi.encodePacked(s1, s2));
    }

    function cat3(string memory s1, string memory s2, string memory s3) internal pure returns (string memory) {
        return string(abi.encodePacked(s1, s2, s3));
    }

    function cat4(string memory s1, string memory s2, string memory s3, string memory s4) internal pure returns (string memory) {
        return string(abi.encodePacked(s1, s2, s3, s4));
    }

    function cat5(string memory s1, string memory s2, string memory s3, string memory s4, string memory s5) internal pure returns (string memory) {
        return string(abi.encodePacked(s1, s2, s3, s4, s5));
    }

    function strEquals(string memory strA, string memory strB) internal pure returns (bool) {
        bytes memory a = bytes(strA);
        bytes memory b = bytes(strB);
        if (a.length < b.length || a.length > b.length) return false;
        for (uint i = 0; i < a.length; i ++)
            if (a[i] < b[i] || a[i] > b[i]) return false;
        return true;
    }
    
    function toString(uint val) internal pure returns (string memory) {
        if (val==0) { return "0"; }
        uint maxlength = 100;
        bytes memory reversed = new bytes(maxlength);
        uint i = 0;
        while (val != 0) {
            uint remainder = val % 10;
            val = val / 10;
            reversed[i++] = bytes1(uint8(48 + remainder));
        }
        bytes memory s = new bytes(i);
        for (uint j = 0; j < i; j++) {
            s[j] = reversed[i - j - 1];
        }
        string memory res = string(s);
        return res;
    }

    function metaToJson(User storage user) internal view returns (string memory)  {
        uint cnt = user.keys.length;
        if(cnt==0){ return "{}"; }
        string memory key;
        string memory val;
        string memory line;
        string memory txt = "{";
        uint last = cnt-1;
        for (uint i = 0; i < cnt; i++) {
            key = user.keys[i];
            val = user.metadata[key];
            line = cat5('"', key, '":"', val, '"');
            if(i<last){
                txt = cat3(txt, line, ",");
            } else {
                txt = cat2(txt, line);  // last
            }
        }
        txt = cat2(txt, "}");
        return txt;
    }

    function userToJson(User storage user) internal view returns (string memory) {
        string memory meta = metaToJson(user);
        string memory txt  = "{";
        txt = cat4(txt, '"created":"' , toString(user.created) , '",');
        txt = cat4(txt, '"userid":"'  , toString(uint256(uint160(user.userId)))  , '",');
        //txt = cat4(txt, '"userid":"'  , abi.encodePacked(address(user.userId))  , '",');
        txt = cat4(txt, '"username":"', user.userName, '",');
        txt = cat4(txt, '"avatar":"'  , user.avatar  , '",');
        txt = cat4(txt, '"price":"'   , toString(user.price), '",');
        txt = cat4(txt, '"metadata":' , meta         , '}');
        return txt;
    }

    function isTaken(string memory name) public view returns (bool) {
        address userId = UserNames[name];
        //require(userId!=address(0x0), 'ERR_USERNAMETAKEN');
        if(userId==address(0x0)){ return false; }
        else { return true; }
    }


//- MAIN

    constructor() {
        operator = msg.sender;
        treasury = payable(msg.sender);
    }

    // New user must pay $1 to register a blank profile
    function blankUser() external payable lock {
        require(msg.value >= USERFEES, 'ERR_NEEDFEES');
        address userId = msg.sender;
        User storage user = Users[userId];
        require(user.created==0, 'ERR_USEREXISTS');
        user.created  = block.timestamp;
        user.userId   = userId;
        user.userName = 'anonymous';
        emit logBlank(userId, msg.value, block.timestamp);
    }

    function newUser(string memory name, string memory avatar) external payable lock {
        address userId = msg.sender;
        uint value = msg.value;
        uint len = bytes(name).length;
        if(len==1){ require(value >= USERFEE1, 'ERR_NEEDFEE1'); }
        if(len==2){ require(value >= USERFEE2, 'ERR_NEEDFEE2'); }
        if(len==3){ require(value >= USERFEE3, 'ERR_NEEDFEE3'); }
        if(len==4){ require(value >= USERFEE4, 'ERR_NEEDFEE4'); }
        if(len==5){ require(value >= USERFEE5, 'ERR_NEEDFEE5'); }
        if(len>=6){ require(value >= USERFEES, 'ERR_NEEDFEES'); }
        require(len>0 && len<21, 'ERR_TOOMANYCHARS');
        require(alphaNum(name), 'ERR_ALPHANUMONLY');
        string memory lower = lowerCase(name);
        require(!isTaken(lower), 'ERR_ALREADYTAKEN');
        User storage user = Users[userId];
        require(user.created==0, 'ERR_USEREXISTS');
        user.created  = block.timestamp;
        user.userId   = userId;
        user.userName = lower;
        user.avatar   = avatar;
        UserNames[lower] = userId;
        emit logNew(userId, lower, avatar, value, block.timestamp);
    }

    // Get your own user info
    function getSelf() public view returns (string memory) {
        address userId = msg.sender;
        User storage user = Users[userId];
        string memory txt = userToJson(user);
        return txt;
    }

    // Anybody can get any users info
    function getUser(address userId) public view returns (string memory) {
        User storage user = Users[userId];
        string memory txt = userToJson(user);
        return txt;
    }

    function getUserByName(string memory name) public view returns (string memory) {
        address userId = UserNames[name];
        //require(uint160(userId)>0, 'ERR_NAMENOTFOUND');
        if(uint160(userId)==0){ return "{}"; }
        User storage user = Users[userId];
        string memory txt = userToJson(user);
        return txt;
    }

    // Only user can delete itself
    function deleteUser() external lock {
        address userId = msg.sender;
        User storage user = Users[userId];
        require(user.created>0, 'ERR_USERNOTFOUND');
        string memory name = user.userName;
        delete Users[userId];
        delete UserNames[name];
        emit logDel(userId, name, block.timestamp);
    }

    function setUserName(string calldata name) external payable lock {
        address userId = msg.sender;
        uint len = bytes(name).length;
        require(len>0 && len<21, 'ERR_TOOMANYCHARS');
        require(alphaNum(name), 'ERR_ALPHANUMONLY');

        string memory lower = lowerCase(name);
        require(!isTaken(lower), 'ERR_ALREADYTAKEN');
        
        User storage user   = Users[userId];
        require(user.created>0, 'ERR_USERNOTFOUND');

        //require(!strEquals(lower,"anonymous"), 'ERR_BLACKLISTED');  // TODO: invalid names list?

        // CHECK FEES
        if(len==1){ require(msg.value >= USERFEE1, 'ERR_NEEDFEE1'); }
        if(len==2){ require(msg.value >= USERFEE2, 'ERR_NEEDFEE2'); }
        if(len==3){ require(msg.value >= USERFEE3, 'ERR_NEEDFEE3'); }
        if(len==4){ require(msg.value >= USERFEE4, 'ERR_NEEDFEE4'); }
        if(len==5){ require(msg.value >= USERFEE5, 'ERR_NEEDFEE5'); }
        if(len>=6){ require(msg.value >= USERFEES, 'ERR_NEEDFEES'); }

        string memory older = user.userName;
        if(bytes(older).length>0) { UserNames[older] = address(0x0); }  // release old user name
        user.userName = lower;
        UserNames[lower] = userId;  // add to usernames
        emit logName(userId, lower, block.timestamp);
    }

    // ipfs:id, file:id or any url
    function setAvatar(string calldata value) external lock {
        address userId = msg.sender;
        User storage user = Users[userId];
        require(user.created>0, 'ERR_USERNOTFOUND');
        user.avatar = value;
    }

    function setPrice(uint value) external lock {
        address userId = msg.sender;
        User storage user = Users[userId];
        require(user.created>0, 'ERR_USERNOTFOUND');
        user.price = value;
    }

    function getPrice(address userId) public view returns (uint) {
        User storage user = Users[userId];
        if(user.created>0) { return user.price; }
        else { return 0; }
    }

    // Can get any user value
    function getValue(address userId, string memory key) public view returns (string memory) {
        User storage user = Users[userId];
        require(user.created>0, 'ERR_USERNOTFOUND');
        return user.metadata[key];
    }

    // Can only set own values
    function setValue(string memory key, string memory val) external lock {
        // Validate key and value max 100 chars
        require(bytes(key).length<101, 'ERR_KEYOVERFLOW');
        require(bytes(val).length<101, 'ERR_VALOVERFLOW');
        address userId = msg.sender;
        User storage user = Users[userId];
        require(user.created>0, 'ERR_USERNOTFOUND');
        bool isNew = true;
        uint cnt = user.keys.length;
        require(cnt<100, 'ERR_MAX100KEYS');
        for (uint i = 0; i < cnt; i++) {
            if(strEquals(key, user.keys[i])){ isNew = false; break; }
        }
        if(isNew){ user.keys.push(key); }
        user.metadata[key] = val;
    }

    // array of keys+values
    function setValues(string[] memory data) external lock {
        address userId = msg.sender;
        require(data.length%2==0, 'ERR_UNEVENKEYS');
        uint len = data.length/2;
        User storage user = Users[userId];
        require(user.created>0, 'ERR_USERNOTFOUND');
        uint cnt = user.keys.length;
        require(cnt<100, 'ERR_MAX100KEYS');
        for(uint i=0; i<len; i++){
            string memory key = data[i];
            string memory val = data[i+len];
            // Validate key and value max 100 chars
            require(bytes(key).length<101, 'ERR_KEYOVERFLOW');
            require(bytes(val).length<101, 'ERR_VALOVERFLOW');
            bool isNew = true;
            for (uint j=0; j < cnt; j++) {
                if(strEquals(key, user.keys[j])){ isNew = false; break; }
            }
            if(isNew){ user.keys.push(key); cnt+=1; }
            user.metadata[key] = val;
            if(cnt>=100){ break; }
        }
    }

    function transfer(address destin) external lock {
        address userId = msg.sender;
        User storage user1 = Users[userId];
        require(user1.created>0, 'ERR_USERNOTFOUND');
        User storage user2 = Users[destin];
        user2.created  = user1.created;
        user2.userId   = destin;
        user2.userName = user1.userName;
        user2.avatar   = user1.avatar;
        //user2.keys   = user1.keys;
        //user2.metadata = user1.metadata;
        UserNames[user2.userName] = destin;
        delete Users[userId];
        emit logTransfer(userId, destin, user2.userName, block.timestamp);
    }

    function buy(address seller) external payable lock {
        address buyer = msg.sender;
        uint value = msg.value;
        User storage user1 = Users[seller];
        require(user1.created>0, 'ERR_SELLERNOTFOUND');
        require(user1.price>0, 'ERR_NOTFORSALE');
        require(value>=user1.price, 'ERR_PAYNOTENOUGH');
        User storage user2 = Users[buyer];
        require(user2.created==0, 'ERR_BUYEREXISTS');
        user2.created  = user1.created; 
        user2.userId   = buyer;
        user2.userName = user1.userName;
        user2.avatar   = user1.avatar;
        user2.price    = 0;
        // Metadata gets cleared
        UserNames[user1.userName] = buyer;
        delete Users[seller];
        emit logBuy(seller, buyer, user2.userName, value, block.timestamp);
    }


//- ADMIN

    function getUserFees() public view vlock returns (uint) {
        return USERFEES;
    }
    
    function setUserFees(uint fee) external admin lock {
        USERFEES = fee;
    }

    function getUserFee1() public view vlock returns (uint) {
        return USERFEE1;
    }
    
    function setUserFee1(uint fee) external admin lock {
        USERFEE1 = fee;
    }

    function getUserFee2() public view vlock returns (uint) {
        return USERFEE2;
    }
    
    function setUserFee2(uint fee) external admin lock {
        USERFEE2 = fee;
    }

    function getUserFee3() public view vlock returns (uint) {
        return USERFEE3;
    }
    
    function setUserFee3(uint fee) external admin lock {
        USERFEE3 = fee;
    }

    function getUserFee4() public view vlock returns (uint) {
        return USERFEE4;
    }
    
    function setUserFee4(uint fee) external admin lock {
        USERFEE4 = fee;
    }

    function getUserFee5() public view vlock returns (uint) {
        return USERFEE5;
    }
    
    function setUserFee5(uint fee) external admin lock {
        USERFEE5 = fee;
    }

    function getOperator() public view vlock returns (address) {
        return operator;
    }
    
    function setOperator(address payable any) external admin lock {
        operator = any;
    }

    function getTreasury() public view vlock returns (address) {
        return treasury;
    }
    
    function setTreasury(address payable any) external admin lock {
        treasury = any;
    }

    function collect() external admin lock {
        address self = address(this);
        if(self.balance > 0) {
            treasury.transfer(self.balance);
        }
    }
}

// END