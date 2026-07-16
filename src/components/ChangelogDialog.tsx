import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { entries } from "@/lib/changelog";

type ChangelogDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ChangelogDialog({ open, onOpenChange }: ChangelogDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Changelog</DialogTitle>
          <DialogDescription>Notable changes to PR:R Tools, newest first.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries yet.</p>
          ) : (
            <ol className="space-y-6">
              {entries.map((entry) => (
                <li
                  key={entry.version}
                  className="border-b border-border pb-5 last:border-b-0 last:pb-0"
                >
                  <div className="flex items-baseline gap-3">
                    <h3 className="text-sm font-semibold text-foreground">v{entry.version}</h3>
                    <time className="text-xs text-muted-foreground" dateTime={entry.date}>
                      {entry.date}
                    </time>
                  </div>

                  <div className="mt-3 space-y-3">
                    {entry.sections.map((section) => (
                      <div key={section.title}>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {section.title}
                        </h4>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground">
                          {section.items.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
