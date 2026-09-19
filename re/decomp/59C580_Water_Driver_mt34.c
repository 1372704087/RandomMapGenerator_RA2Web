// 0x59c580 Water_Driver_mt34 size=A3

char __thiscall sub_59C580(int *this)
{
  int v2; // eax
  int v3; // edi
  int v4; // edi
  char result; // al
  __int16 v6; // [esp+Ch] [ebp-4h] BYREF
  __int16 v7; // [esp+Eh] [ebp-2h]

  v2 = *(this + 15);
  ++*(this + 194);
  if ( (v2 == 3 || v2 == 4) && *(this + 19) > 20 )
  {
    v3 = 0;
    while ( v3 < 10 )
    {
      v6 = 0;
      v7 = 0;
      ++v3;
      if ( sub_59D510(this, (int)&v6, 0.0, 0) != 0 )
      {
        ++*(this + 194);
        break;
      }
    }
  }
  v4 = 0;
  result = 0;
  while ( v4 < 10 )
  {
    v6 = 0;
    v7 = 0;
    result = sub_59C920(this, &v6);
    ++v4;
    if ( result != 0 )
    {
      ++*(this + 194);
      return result;
    }
  }
  return result;
}
