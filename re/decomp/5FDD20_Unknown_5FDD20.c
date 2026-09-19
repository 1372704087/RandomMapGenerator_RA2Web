// 0x5fdd20 Unknown_5FDD20 size=BE

int __fastcall sub_5FDD20(int a1)
{
  int v1; // eax
  int v2; // ebx
  char *v3; // edi
  _DWORD *v4; // eax
  int v5; // edx
  int v6; // esi
  const char *v8[17]; // [esp-34h] [ebp-48h] BYREF
  int v9; // [esp+10h] [ebp-4h]

  if ( a1 == -1 )
    return -1;
  v1 = *((_DWORD *)dword_A83D84 + a1);
  v9 = v1;
  if ( *(_BYTE *)(v1 + 681) == 0 )
    return -1;
  v2 = 0;
  if ( dword_B0F4F8 <= 0 )
  {
LABEL_11:
    qmemcpy(v8, (const void *)(v1 + 100), 0x31u);
    nullsub_1("Overlay %s not really tiberium\n", v8[0]);
    return 0;
  }
  else
  {
    v3 = (char *)dword_B0F4EC;
    while ( 1 )
    {
      v4 = *(_DWORD **)v3;
      v5 = *(_DWORD *)(*(_DWORD *)(*(_DWORD *)v3 + 224) + 660);
      if ( a1 >= v5 && a1 < v5 + v4[58] )
        break;
      v6 = v4[58];
      if ( a1 >= v6 + v5 && a1 < v5 + v6 + v4[59] )
        break;
      ++v2;
      v3 += 4;
      if ( v2 >= dword_B0F4F8 )
      {
        v1 = v9;
        goto LABEL_11;
      }
    }
    return v4[38];
  }
}
