## PIFPY - Profiles in the blockchain

![hero](https://raw.githubusercontent.com/kuyawa/pifpy/main/stuff/pifpy.jpg)

PFP (ProFile Picture) is the new craze in the blockchain world and PIFPY is the right place to create, share and sell your PFPs. You can create your profile and upload an avatar to the blockchain so all dApps can use your info without having to enter it everytime, allowing login and authentication in just one click! PIFPY is the logical evolution of NTFs, get your unique user name before everyone else and enjoy all the benefits.

# With PIFPY you can:

- use your crypto wallet as authenticator
- select a unique user name
- upload an avatar to the blockchain
- add extra fields like twitter, instagram, website, crypto addresses, etc
- any key/value pair can be used as metadata
- share your avatar/profile with the world
- sell your PFPs amd make tons of money

### PIFPY uses the contract address 0.0.34735480 in Testnet for quick interaction with profiles:

    pifpy = new PIFPY()
    pifpy.login()
    pifpy.newUser()
    pifpy.setUserName(name)
    pifpy.upload(file)
    pifpy.setAvatar(fileId)
    pifpy.setValue(key,value)
    pifpy.getValue(address,key)
    pifpy.getSelf()
    pifpy.getUser(address)
    pifpy.getUserByName(name)
    pifpy.deleteUser()

## Start creating your universal profile right now in [pifpy.com](https://pifpy.com)