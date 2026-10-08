import { Global, Module } from '@nestjs/common';
import { SqliteMessageHistoryService } from './sqlite-message-history.service';

// One archive writer per API process. A future horizontally scaled API must
// use a dedicated archiving process or leader election, not shared SQLite files.
@Global()
@Module({
  providers:[SqliteMessageHistoryService],
  exports:[SqliteMessageHistoryService],
})
export class MessageHistoryModule {}
