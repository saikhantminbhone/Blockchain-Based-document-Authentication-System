// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract DocumentRegistry is Ownable {

    mapping(bytes32 => uint256) public documentTimestamps;
    event DocumentVerified(
        bytes32 indexed docHash, 
        string landlordName, 
        string unitInfo,
        string tenantName,
        string from,
        string to,
        uint256 timestamp
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
    ) public onlyOwner {
        require(documentTimestamps[_docHash] == 0, "Document already verified");

        // The ONLY storage write. This is a huge gas saving.
        documentTimestamps[_docHash] = block.timestamp;
        emit DocumentVerified(
            _docHash, 
            _landlordName, 
            _unitInfo, 
            _tenantName, 
            _from, 
            _to, 
            block.timestamp
        );
    }

    function getDocumentTimestamp(bytes32 _docHash) 
        public 
        view 
        returns (uint256) 
    {
        return documentTimestamps[_docHash];
    }
}