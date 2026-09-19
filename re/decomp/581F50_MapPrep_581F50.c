// 0x581f50 MapPrep_581F50 size=35

int __thiscall sub_581F50(char *this)
{
  int v1; // esi
  char *v2; // edi

  v1 = 2;
  v2 = this + 188;
  do
  {
    (*(void (__thiscall **)(char *))(*(_DWORD *)v2 + 12))(v2);
    sub_581F90(v1--);
    v2 -= 24;
  }
  while ( v1 >= 0 );
  return sub_42C1C0(&unk_87E8B8);
}
