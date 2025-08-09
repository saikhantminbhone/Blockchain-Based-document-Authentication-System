// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";


contract DocumentRegistry is Ownable { 

    // --- State Variables ---

    struct Document {
        bytes32 docHash;
        string landlordName;
        string unitInfo;
        string tenantName;
        string from;
        string to;
        uint256 timestamp;
        bool isVerified;
    }

    mapping(bytes32 => Document) public documents;

    // --- Events ---

    event DocumentVerified(
        bytes32 indexed docHash, 
        string landlordName, 
        string unitInfo
    );

    constructor() Ownable(msg.sender) {}


    // --- Functions ---

    function addDocument(
        bytes32 _docHash, 
        string calldata _landlordName, 
        string calldata _unitInfo,
        string calldata _tenantName,
        string calldata _from,
        string calldata _to
    ) public onlyOwner { // This will now compile correctly
        require(!documents[_docHash].isVerified, "Document already verified");

        documents[_docHash] = Document({
            docHash: _docHash,
            landlordName: _landlordName,
            unitInfo: _unitInfo,
            tenantName: _tenantName,
            from:_from,
            to:_to,
            timestamp: block.timestamp,
            isVerified: true
        });

        emit DocumentVerified(_docHash, _landlordName, _unitInfo);
    }

    function getDocument(bytes32 _docHash) 
        public 
        view 
        returns (bool, string memory, string memory,string memory,string memory,string memory, uint256) 
    {
        Document storage doc = documents[_docHash];
        return (
            doc.isVerified,
            doc.landlordName,
            doc.unitInfo,
            doc.tenantName,
            doc.from,
            doc.to,
            doc.timestamp
        );
    }
}