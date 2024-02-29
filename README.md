# Slides API Example

Show an example of how we could use the google slides api instead of the pptxgen library. This allows us to only worry about creating the slide content and not the design.

## What is happening

After authorization a copy of the presentation is created. All the "placeholder" text is replaced, and then exported as a pptx file.

## Considerations

- Presentation design can be maintained and controlled by marketing team.
- Presentation should be locked
- Copies can be kept in drive for 30 days (or whatever period of time) for troubleshooting purposes
