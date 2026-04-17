// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract EduChainRegistry {
    enum RecordType {
        Diploma,
        Certificate,
        CourseResult
    }

    struct Credential {
        string recordId;
        string studentWallet;
        string studentName;
        string institutionName;
        string title;
        string metadataURI;
        bytes32 credentialHash;
        RecordType recordType;
        uint256 issuedAt;
        bool active;
    }

    mapping(string => Credential) private credentials;
    mapping(string => bool) public exists;

    event CredentialIssued(
        string indexed recordId,
        string indexed studentWallet,
        bytes32 credentialHash,
        RecordType recordType
    );

    event CredentialRevoked(string indexed recordId);

    function issueCredential(
        string calldata recordId,
        string calldata studentWallet,
        string calldata studentName,
        string calldata institutionName,
        string calldata title,
        string calldata metadataURI,
        bytes32 credentialHash,
        RecordType recordType
    ) external {
        require(!exists[recordId], "Credential already exists");

        credentials[recordId] = Credential({
            recordId: recordId,
            studentWallet: studentWallet,
            studentName: studentName,
            institutionName: institutionName,
            title: title,
            metadataURI: metadataURI,
            credentialHash: credentialHash,
            recordType: recordType,
            issuedAt: block.timestamp,
            active: true
        });

        exists[recordId] = true;
        emit CredentialIssued(recordId, studentWallet, credentialHash, recordType);
    }

    function revokeCredential(string calldata recordId) external {
        require(exists[recordId], "Credential not found");
        credentials[recordId].active = false;
        emit CredentialRevoked(recordId);
    }

    function verifyCredential(
        string calldata recordId,
        bytes32 expectedHash
    ) external view returns (bool valid, Credential memory credential) {
        credential = credentials[recordId];
        valid =
            exists[recordId] &&
            credential.active &&
            credential.credentialHash == expectedHash;
    }

    function getCredential(
        string calldata recordId
    ) external view returns (Credential memory) {
        require(exists[recordId], "Credential not found");
        return credentials[recordId];
    }
}
