// import { Injectable } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { Repository } from 'typeorm';
// import { Transaction } from '../entities/transaction.entity';

// @Injectable()
// export class TransactionService {
//   constructor(
//     @InjectRepository(Transaction)
//     private transactionRepository: Repository<Transaction>,
//   ) {}

//   async save(transaction: Transaction): Promise<Transaction> {
//     return this.transactionRepository.save(transaction);
//   }
// }
