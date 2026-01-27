# Shadow Atlas API Integration

Shadow Atlas provides district lookup and Merkle proof generation for ZK proofs.

**Cross-Repository References:**
- voter-protocol implementation: [SHADOW-ATLAS-SPEC.md](/Users/noot/Documents/voter-protocol/specs/SHADOW-ATLAS-SPEC.md)
- Proof architecture: [UNIFIED-PROOF-ARCHITECTURE.md](/Users/noot/Documents/voter-protocol/specs/UNIFIED-PROOF-ARCHITECTURE.md)

## Endpoints

### District Lookup
```
GET /v1/lookup?lat={latitude}&lng={longitude}
```

**Response:**
```json
{
  "districts": {
    "congressional": "CA-12",
    "state_senate": "CA-SD-11",
    "state_house": "CA-AD-17",
    "city_council": "SF-D5"
  },
  "merkleRoots": {
    "congressional": "0x...",
    "state_senate": "0x..."
  }
}
```

### Merkle Proof Retrieval
```
GET /v1/proof?district={district_id}&leaf={leaf_hash}
```

**Response:**
```json
{
  "path": ["0x...", "0x...", ...],
  "index": 1234,
  "root": "0x...",
  "depth": 20
}
```

## Error Handling

| Code | Meaning |
|------|---------|
| 404 | District not found |
| 400 | Invalid coordinates |
| 503 | Tree rebuilding |
